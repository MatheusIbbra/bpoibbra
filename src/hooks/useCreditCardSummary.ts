import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface CreditCardSummary {
  accountId: string;
  accountName: string;
  bankName: string | null;
  /** Invoice balance (fatura atual): total spent minus payments, always >= 0 */
  invoiceBalance: number;
  /** Credit limit from Open Finance, or null if unknown */
  creditLimit: number | null;
  /** Available credit = limit - invoice */
  availableCredit: number | null;
  monthlyPurchases: number;
  monthlyPayments: number;
  // kept for compat
  currentBalance: number;
  amountDue: number;
}

export function useCreditCardSummary() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["credit-card-summary", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<CreditCardSummary[]> => {
      // 1. Fetch credit card accounts
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

      const { data: accounts, error: accError } = await accountsQuery;
      if (accError) throw accError;
      if (!accounts || accounts.length === 0) return [];

      const accountIds = accounts.map((a) => a.id);

      // 2. Fetch Open Finance account data (credit_limit, available_credit, balance, raw_data)
      const { data: ofAccounts } = await supabase
        .from("open_finance_accounts")
        .select("local_account_id, credit_limit, available_credit, balance, raw_data")
        .in("local_account_id", accountIds);

      // Build map: local_account_id → OF data
      const ofMap = new Map<string, typeof ofAccounts extends (infer T)[] | null | undefined ? T : never>();
      ofAccounts?.forEach((ofa) => {
        if (ofa.local_account_id) ofMap.set(ofa.local_account_id, ofa);
      });

      // 3. Fetch this month's transactions
      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

      const { data: transactions } = await supabase
        .from("transactions")
        .select("account_id, amount, type, is_ignored")
        .in("account_id", accountIds)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .neq("is_ignored", true);

      // 4. Build summaries
      const summaries: CreditCardSummary[] = accounts.map((account) => {
        const accountTxs = transactions?.filter((tx) => tx.account_id === account.id) || [];

        let monthlyPurchases = 0;
        let monthlyPayments = 0;

        accountTxs.forEach((tx) => {
          const amount = Number(tx.amount);
          if (tx.type === "expense") {
            monthlyPurchases += amount;
          } else if (tx.type === "income" || tx.type === "transfer" || tx.type === "redemption") {
            monthlyPayments += amount;
          }
        });

        // Invoice balance = purchases - payments (>= 0)
        const invoiceBalance = Math.max(0, monthlyPurchases - monthlyPayments);

        // Credit limit from OF data
        let creditLimit: number | null = null;
        let availableCredit: number | null = null;

        const ofa = ofMap.get(account.id);
        if (ofa) {
          // Prefer raw_data.creditData.creditLimit → of.credit_limit
          const rawCreditData = (ofa.raw_data as any)?.creditData;
          const rawLimit = rawCreditData?.creditLimit != null ? Number(rawCreditData.creditLimit) : null;
          const dbLimit = ofa.credit_limit != null ? Number(ofa.credit_limit) : null;
          creditLimit = (dbLimit && dbLimit > 0) ? dbLimit : (rawLimit && rawLimit > 0 ? rawLimit : null);

          if (creditLimit != null) {
            // Available credit: use OF available_credit field if present, else limit - invoice
            const ofAvail = ofa.available_credit != null ? Number(ofa.available_credit) : null;
            availableCredit = ofAvail != null ? Math.max(0, ofAvail) : Math.max(0, creditLimit - invoiceBalance);
          }
        }

        // Fallback: use current_balance as negative debt indicator
        const balanceDebt = Math.abs(Number(account.current_balance) || 0);
        const effectiveInvoice = invoiceBalance > 0 ? invoiceBalance : balanceDebt;

        return {
          accountId: account.id,
          accountName: account.name,
          bankName: account.bank_name,
          invoiceBalance: effectiveInvoice,
          creditLimit,
          availableCredit,
          monthlyPurchases,
          monthlyPayments,
          currentBalance: Number(account.current_balance) || 0,
          amountDue: effectiveInvoice,
        };
      });

      return summaries.filter((s) => s.monthlyPurchases > 0 || s.invoiceBalance > 0);
    },
    enabled: !!user,
  });
}
