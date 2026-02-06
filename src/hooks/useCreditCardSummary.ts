import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface CreditCardSummary {
  accountId: string;
  accountName: string;
  bankName: string | null;
  currentBalance: number;
  monthlyPurchases: number;
  monthlyPayments: number;
  amountDue: number;
}

export function useCreditCardSummary() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["credit-card-summary", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<CreditCardSummary[]> => {
      // Get credit card accounts
      let accountsQuery = supabase
        .from("accounts")
        .select("id, name, bank_name, current_balance")
        .eq("account_type", "credit_card")
        .eq("status", "active");

      if (orgFilter.type === 'single') {
        accountsQuery = accountsQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        accountsQuery = accountsQuery.in("organization_id", orgFilter.ids);
      }

      const { data: accounts, error: accError } = await accountsQuery;
      if (accError) throw accError;
      if (!accounts || accounts.length === 0) return [];

      const now = new Date();
      const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
      const accountIds = accounts.map(a => a.id);

      // Get this month's transactions for credit card accounts
      let txQuery = supabase
        .from("transactions")
        .select("account_id, amount, type")
        .in("account_id", accountIds)
        .gte("date", monthStart)
        .lte("date", monthEnd);

      const { data: transactions } = await txQuery;

      // Calculate per-account summaries
      const summaries: CreditCardSummary[] = accounts.map(account => {
        const accountTxs = transactions?.filter(tx => tx.account_id === account.id) || [];
        
        let monthlyPurchases = 0;
        let monthlyPayments = 0;

        accountTxs.forEach(tx => {
          const amount = Number(tx.amount);
          if (tx.type === "expense") {
            monthlyPurchases += amount;
          } else if (tx.type === "income" || tx.type === "transfer") {
            monthlyPayments += amount;
          }
        });

        // Balance from RPC (negative = owed)
        const balance = Number(account.current_balance) || 0;
        const amountDue = Math.abs(Math.min(balance, 0));

        return {
          accountId: account.id,
          accountName: account.name,
          bankName: account.bank_name,
          currentBalance: balance,
          monthlyPurchases,
          monthlyPayments,
          amountDue,
        };
      });

      return summaries.filter(s => s.monthlyPurchases > 0 || s.amountDue > 0);
    },
    enabled: !!user,
  });
}
