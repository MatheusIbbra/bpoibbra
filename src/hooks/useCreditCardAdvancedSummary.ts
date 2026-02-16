import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface CreditCardInvoiceMonth {
  month: number;
  year: number;
  label: string;
  totalPurchases: number;
  totalPayments: number;
  balance: number;
  status: "paid" | "partial" | "open";
}

export interface CreditCardAdvanced {
  id: string;
  name: string;
  bankName: string | null;
  bankLogo: string | null;
  limit: number;
  used: number;
  available: number;
  invoiceAmount: number;
  dueDate: string | null;
  bestPurchaseDay: string | null;
  invoicesByMonth: CreditCardInvoiceMonth[];
}

export interface CreditCardAdvancedSummaryData {
  totalLimit: number;
  totalUsed: number;
  totalAvailable: number;
  cards: CreditCardAdvanced[];
}

export function useCreditCardAdvancedSummary() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["credit-card-advanced-summary", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<CreditCardAdvancedSummaryData> => {
      // 1. Get credit card accounts
      let accountsQuery = supabase
        .from("accounts")
        .select("id, name, bank_name, current_balance")
        .eq("account_type", "credit_card")
        .eq("status", "active");

      if (orgFilter.type === "single") {
        accountsQuery = accountsQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
        accountsQuery = accountsQuery.in("organization_id", orgFilter.ids);
      }

      const { data: accounts } = await accountsQuery;
      if (!accounts || accounts.length === 0) {
        return { totalLimit: 0, totalUsed: 0, totalAvailable: 0, cards: [] };
      }

      const accountIds = accounts.map((a) => a.id);

      // 2. Get open_finance_accounts linked to these accounts (primary source of truth)
      const { data: ofAccounts } = await supabase
        .from("open_finance_accounts")
        .select("local_account_id, balance, credit_limit, available_credit, due_day, closing_day")
        .in("local_account_id", accountIds);

      const ofMap = new Map<string, {
        balance: number | null;
        creditLimit: number | null;
        availableCredit: number | null;
        dueDay: number | null;
        closingDay: number | null;
      }>();
      ofAccounts?.forEach((ofa) => {
        if (ofa.local_account_id) {
          ofMap.set(ofa.local_account_id, {
            balance: ofa.balance != null ? Number(ofa.balance) : null,
            creditLimit: ofa.credit_limit != null ? Number(ofa.credit_limit) : null,
            availableCredit: ofa.available_credit != null ? Number(ofa.available_credit) : null,
            dueDay: ofa.due_day,
            closingDay: ofa.closing_day,
          });
        }
      });

      // 3. Get bank connections metadata for logos and fallback credit data
      const { data: connections } = await supabase
        .from("bank_connections")
        .select("metadata")
        .eq("status", "active");

      // Build bank logo map
      const bankLogoMap = new Map<string, string>();
      const pluggyCreditMap = new Map<string, { availableCredit: number; totalLimit: number }>();
      connections?.forEach((conn) => {
        const meta = conn.metadata as any;
        if (meta?.bank_name && meta?.bank_logo_url) {
          bankLogoMap.set(meta.bank_name, meta.bank_logo_url);
        }
        // Fallback: extract credit data from Pluggy metadata
        const pluggyAccounts = meta?.pluggy_accounts || [];
        pluggyAccounts.forEach((pa: any) => {
          if (pa.type?.toUpperCase() === "CREDIT") {
            const key = pa.name || meta?.bank_name || "";
            const balance = Math.abs(pa.balance || 0);
            const avail = Math.max(0, pa.available_balance || 0);
            pluggyCreditMap.set(key, {
              availableCredit: avail,
              totalLimit: balance + avail,
            });
          }
        });
      });

      // 4. Get last 6 months of transactions for all credit card accounts
      const now = new Date();
      const sixMonthsAgo = subMonths(startOfMonth(now), 5);

      const { data: transactions } = await supabase
        .from("transactions")
        .select("account_id, amount, type, date, accrual_date")
        .in("account_id", accountIds)
        .gte("date", format(sixMonthsAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      // 5. Build per-card data
      const cards: CreditCardAdvanced[] = accounts.map((account) => {
        const debt = Math.abs(Number(account.current_balance) || 0);
        const bankLogo = account.bank_name ? bankLogoMap.get(account.bank_name) || null : null;
        const ofData = ofMap.get(account.id);

        let limit = 0;
        let available = 0;

        if (ofData?.creditLimit != null && ofData.creditLimit > 0) {
          // Best source: open_finance_accounts credit_limit
          limit = ofData.creditLimit;
          available = ofData.availableCredit != null ? Math.max(0, ofData.availableCredit) : Math.max(0, limit - debt);
        } else if (ofData?.balance != null && ofData.availableCredit != null) {
          // Derive from OF balance + available_credit
          const ofDebt = Math.abs(ofData.balance);
          available = Math.max(0, ofData.availableCredit);
          limit = ofDebt + available;
        } else {
          // Fallback: try Pluggy metadata
          let foundCreditData = false;
          for (const [key, data] of pluggyCreditMap.entries()) {
            if (key === account.name || (account.bank_name && key.includes(account.bank_name))) {
              limit = data.totalLimit;
              available = data.availableCredit;
              foundCreditData = true;
              break;
            }
          }
          if (!foundCreditData && debt > 0) {
            limit = debt * 1.5;
            available = Math.max(0, limit - debt);
          }
        }

        const used = Math.min(debt, limit > 0 ? limit : debt);

        // Due date from open_finance_accounts
        let dueDate: string | null = null;
        let bestPurchaseDay: string | null = null;
        if (ofData?.dueDay) {
          dueDate = `Dia ${ofData.dueDay}`;
        }
        if (ofData?.closingDay) {
          // Best purchase day is the day after the closing day
          const bestDay = ofData.closingDay >= 28 ? 1 : ofData.closingDay + 1;
          bestPurchaseDay = `Dia ${bestDay}`;
        }

        // Group transactions by month for invoices
        const accountTxs = transactions?.filter((tx) => tx.account_id === account.id) || [];
        const monthMap = new Map<string, { purchases: number; payments: number }>();

        accountTxs.forEach((tx) => {
          const txDateStr = tx.accrual_date || tx.date;
          const txDate = parseISO(txDateStr);
          const key = format(txDate, "yyyy-MM");
          const existing = monthMap.get(key) || { purchases: 0, payments: 0 };

          const amount = Number(tx.amount);
          if (tx.type === "expense") {
            existing.purchases += amount;
          } else if (tx.type === "income" || tx.type === "transfer") {
            existing.payments += amount;
          }
          monthMap.set(key, existing);
        });

        const invoicesByMonth: CreditCardInvoiceMonth[] = [];
        const sortedKeys = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));

        sortedKeys.forEach((key) => {
          const [yearStr, monthStr] = key.split("-");
          const year = parseInt(yearStr);
          const month = parseInt(monthStr);
          const data = monthMap.get(key)!;

          const refDate = new Date(year, month - 1, 1);
          const label = format(refDate, "MMMM yyyy", { locale: ptBR });
          const balance = data.purchases - data.payments;

          let status: "paid" | "partial" | "open" = "open";
          if (balance <= 0) status = "paid";
          else if (data.payments > 0) status = "partial";

          invoicesByMonth.push({
            month,
            year,
            label: label.charAt(0).toUpperCase() + label.slice(1),
            totalPurchases: data.purchases,
            totalPayments: data.payments,
            balance: Math.max(0, balance),
            status,
          });
        });

        // Current month invoice amount
        const currentKey = format(now, "yyyy-MM");
        const currentInvoice = monthMap.get(currentKey);
        const invoiceAmount = currentInvoice
          ? Math.max(0, currentInvoice.purchases - currentInvoice.payments)
          : debt;

        return {
          id: account.id,
          name: account.name,
          bankName: account.bank_name,
          bankLogo,
          limit,
          used,
          available,
          invoiceAmount,
          dueDate,
          bestPurchaseDay,
          invoicesByMonth,
        };
      });

      const totalLimit = cards.reduce((sum, c) => sum + c.limit, 0);
      const totalUsed = cards.reduce((sum, c) => sum + c.used, 0);
      const totalAvailable = cards.reduce((sum, c) => sum + c.available, 0);

      return { totalLimit, totalUsed, totalAvailable, cards };
    },
    enabled: !!user,
  });
}
