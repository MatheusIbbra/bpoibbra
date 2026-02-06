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

      // 2. Get bank connections metadata for limit info
      let connectionsQuery = supabase
        .from("bank_connections")
        .select("metadata")
        .eq("status", "active");

      const { data: connections } = await connectionsQuery;

      // Build map: account name / bank name → credit data from Pluggy metadata
      const creditDataMap = new Map<string, { availableCredit: number; totalLimit: number }>();
      connections?.forEach((conn) => {
        const meta = conn.metadata as any;
        const pluggyAccounts = meta?.pluggy_accounts || [];
        pluggyAccounts.forEach((pa: any) => {
          if (pa.type?.toUpperCase() === "CREDIT" && pa.available_balance != null) {
            const key = pa.name || meta?.bank_name || "";
            const balance = Math.abs(pa.balance || 0);
            const availableCredit = pa.available_balance || 0;
            creditDataMap.set(key, {
              availableCredit,
              totalLimit: balance + availableCredit,
            });
          }
        });
      });

      // Build bank logo map
      const bankLogoMap = new Map<string, string>();
      connections?.forEach((conn) => {
        const meta = conn.metadata as any;
        if (meta?.bank_name && meta?.bank_logo_url) {
          bankLogoMap.set(meta.bank_name, meta.bank_logo_url);
        }
      });

      // 3. Get last 6 months of transactions for all credit card accounts
      const now = new Date();
      const sixMonthsAgo = subMonths(startOfMonth(now), 5);
      const accountIds = accounts.map((a) => a.id);

      const { data: transactions } = await supabase
        .from("transactions")
        .select("account_id, amount, type, date, accrual_date")
        .in("account_id", accountIds)
        .gte("date", format(sixMonthsAgo, "yyyy-MM-dd"))
        .order("date", { ascending: false });

      // 4. Build per-card data
      const cards: CreditCardAdvanced[] = accounts.map((account) => {
        const debt = Math.abs(Number(account.current_balance) || 0);
        const bankLogo = account.bank_name ? bankLogoMap.get(account.bank_name) || null : null;

        // Try to find credit data from Pluggy metadata
        let limit = 0;
        let available = 0;
        let foundCreditData = false;

        // Try matching by account name, then by bank name
        for (const [key, data] of creditDataMap.entries()) {
          if (
            key === account.name ||
            (account.bank_name && key.includes(account.bank_name))
          ) {
            limit = data.totalLimit;
            available = data.availableCredit;
            foundCreditData = true;
            break;
          }
        }

        if (!foundCreditData) {
          // Estimate limit from debt (rough approximation)
          limit = debt > 0 ? debt * 1.5 : 0;
          available = Math.max(0, limit - debt);
        }

        const used = debt;

        // Group transactions by month for invoices
        const accountTxs = transactions?.filter((tx) => tx.account_id === account.id) || [];
        const monthMap = new Map<string, { purchases: number; payments: number }>();

        accountTxs.forEach((tx) => {
          // Use accrual_date if available, otherwise date
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
          dueDate: null, // Would need due_date from metadata
          bestPurchaseDay: null,
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
