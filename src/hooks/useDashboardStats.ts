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

export function useDashboardStats() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  
  return useQuery({
    queryKey: ["dashboard-stats", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      
      const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
      const endOfMonth = new Date(currentYear, currentMonth, 0).toISOString().split("T")[0];
      
      const startOfLastMonth = `${lastMonthYear}-${String(lastMonth).padStart(2, "0")}-01`;
      const endOfLastMonth = new Date(lastMonthYear, lastMonth, 0).toISOString().split("T")[0];
      
      // Build base query for transactions - exclude ignored and pending
      const buildTransactionQuery = (start: string, end: string) => {
        let query = supabase
          .from("transactions")
          .select("amount, type")
          .gte("date", start)
          .lte("date", end)
          .neq("is_ignored", true)
          .in("validation_status", ["validated", "pending_validation"]);
        
        if (orgFilter.type === 'single') {
          query = query.eq("organization_id", orgFilter.ids[0]);
        } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
          query = query.in("organization_id", orgFilter.ids);
        }
        
        return query;
      };
      
      // Current month transactions
      const { data: currentMonthData } = await buildTransactionQuery(startOfMonth, endOfMonth);
      
      // Last month transactions
      const { data: lastMonthData } = await buildTransactionQuery(startOfLastMonth, endOfLastMonth);
      
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
          if (account.account_type === 'credit_card' || account.account_type === 'investment') continue;
          
          if (localAccountsWithOF.has(account.id)) {
            totalAccountBalance += ofBalanceByLocalAccount.get(account.id) || 0;
            continue;
          }
          
          // Use current_balance from snapshot (maintained by trigger) — no full-scan RPC
          totalAccountBalance += account.current_balance ?? account.initial_balance ?? 0;
        }
      }
      
      const calculateTotals = (data: { amount: number; type: string }[] | null) => {
        if (!data) return { income: 0, expenses: 0 };
        return data.reduce(
          (acc, t) => {
            if (t.type === "income") {
              acc.income += Number(t.amount);
            } else if (t.type === "expense") {
              acc.expenses += Number(t.amount);
            }
            return acc;
          },
          { income: 0, expenses: 0 }
        );
      };
      
      const currentTotals = calculateTotals(currentMonthData);
      const lastTotals = calculateTotals(lastMonthData);
      
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
