import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface DashboardStats {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  monthlySavings: number;
  incomeChange: number;
  expenseChange: number;
}

export function useDashboardStats(selectedMonth?: Date) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  
  return useQuery({
    queryKey: ["dashboard-stats", user?.id, orgFilter.type, orgFilter.ids, selectedMonth?.toISOString()],
    queryFn: async (): Promise<DashboardStats> => {
      const refDate = selectedMonth || new Date();
      const currentMonth = refDate.getMonth() + 1;
      const currentYear = refDate.getFullYear();
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
      const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0];
      const startOfLastMonth = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-01`;
      const endOfLastMonth = new Date(lastMonthYear, lastMonth, 0).toISOString().split("T")[0];

      // ─────────────────────────────────────────────────────────────
      // KPIs via transactions table — filtering is_ignored=true out
      // explicitly. Transfers, investments and redemptions are excluded
      // by only selecting 'income' and 'expense' types.
      // financial_events was NOT used here because it stores events for
      // ignored transactions too (they still affect account balance),
      // which would inflate income/expense numbers shown to the user.
      // ─────────────────────────────────────────────────────────────
      const buildTxQuery = (start: string, end: string) => {
        let q = supabase
          .from("transactions")
          .select("type, amount")
          .in("type", ["income", "expense"])
          .neq("is_ignored", true)
          .gte("date", start)
          .lte("date", end);

        if (orgFilter.type === "single") {
          q = q.eq("organization_id", orgFilter.ids[0]);
        } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
          q = q.in("organization_id", orgFilter.ids);
        }
        return q;
      };

      const [{ data: currentEventsData }, { data: lastEventsData }] = await Promise.all([
        buildTxQuery(startOfMonth, endOfMonth),
        buildTxQuery(startOfLastMonth, endOfLastMonth),
      ]);
      
      // Get local accounts with snapshot balances (no full-scan RPC)
      let accountsQuery = supabase
        .from("accounts")
        .select("id, initial_balance, current_balance, account_type, official_balance, last_official_balance_at")
        .eq("status", "active");
      
      if (orgFilter.type === 'single') {
        accountsQuery = accountsQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        accountsQuery = accountsQuery.in("organization_id", orgFilter.ids);
      }
      
      const { data: accountsData } = await accountsQuery;
      
      // Get all Open Finance accounts to properly sum balances
      let ofQuery = supabase
        .from("open_finance_accounts")
        .select("balance, account_type, local_account_id");
      
      if (orgFilter.type === 'single') {
        ofQuery = ofQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        ofQuery = ofQuery.in("organization_id", orgFilter.ids);
      }
      
      const { data: ofAccounts } = await ofQuery;
      
      // Build a map of local_account_id -> sum of OF balances (non-credit-card only)
      const ofBalanceByLocalAccount = new Map<string, number>();
      const localAccountsWithOF = new Set<string>();
      
      if (ofAccounts) {
        for (const ofa of ofAccounts) {
          if (ofa.account_type?.toUpperCase() === 'CREDIT') continue;
          if (ofa.local_account_id) {
            localAccountsWithOF.add(ofa.local_account_id);
            ofBalanceByLocalAccount.set(
              ofa.local_account_id,
              (ofBalanceByLocalAccount.get(ofa.local_account_id) || 0) + Number(ofa.balance || 0)
            );
          }
        }
      }
      
      let totalAccountBalance = 0;
      
      if (accountsData) {
        for (const account of accountsData) {
          if (account.account_type === 'credit_card') continue;
          
          if (localAccountsWithOF.has(account.id)) {
            totalAccountBalance += ofBalanceByLocalAccount.get(account.id) || 0;
            continue;
          }
          
          // Prefer official_balance (from Open Finance API) when available
          if (account.official_balance !== null && account.official_balance !== undefined) {
            totalAccountBalance += Number(account.official_balance);
          } else {
            // current_balance is maintained by trigger (initial_balance + net transactions).
            // However, for brand-new manual accounts with no transactions, the trigger never fired
            // so current_balance = 0 (DB default) even though initial_balance > 0.
            // Fix: if current_balance is null/undefined/0, fall back to initial_balance.
            const cb = account.current_balance;
            const ib = account.initial_balance ?? 0;
            totalAccountBalance += (cb !== null && cb !== undefined && cb !== 0) ? Number(cb) : Number(ib);
          }
        }
      }
      
      // Aggregate income/expenses from transactions
      const calcEventTotals = (txs: { type: string; amount: number }[] | null) => {
        if (!txs) return { income: 0, expenses: 0 };
        return (txs as any[]).reduce(
          (acc: { income: number; expenses: number }, tx: any) => {
            const amt = Number(tx.amount);
            if (tx.type === "income") acc.income += amt;
            else if (tx.type === "expense") acc.expenses += amt;
            return acc;
          },
          { income: 0, expenses: 0 }
        );
      };

      const currentTotals = calcEventTotals(currentEventsData as any);
      const lastTotals    = calcEventTotals(lastEventsData as any);
      
      const totalBalance = totalAccountBalance;
      const monthlyIncome = currentTotals.income;
      const monthlyExpenses = currentTotals.expenses;
      const monthlySavings = monthlyIncome - monthlyExpenses;
      
      const incomeChange = lastTotals.income > 0
        ? ((monthlyIncome - lastTotals.income) / lastTotals.income) * 100
        : 0;
      
      const expenseChange = lastTotals.expenses > 0
        ? ((monthlyExpenses - lastTotals.expenses) / lastTotals.expenses) * 100
        : 0;
      
      return {
        totalBalance,
        monthlyIncome,
        monthlyExpenses,
        monthlySavings,
        incomeChange,
        expenseChange,
      };
    },
    enabled: !!user,
  });
}
