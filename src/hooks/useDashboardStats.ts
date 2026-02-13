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
      
      // Get accounts - prioritize official_balance from Open Finance API
      let accountsQuery = supabase
        .from("accounts")
        .select("id, initial_balance, account_type, official_balance, last_official_balance_at");
      
      if (orgFilter.type === 'single') {
        accountsQuery = accountsQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        accountsQuery = accountsQuery.in("organization_id", orgFilter.ids);
      }
      
      const { data: accountsData } = await accountsQuery;
      
      let totalAccountBalance = 0;
      const linkedLocalAccountIds = new Set<string>();
      
      if (accountsData) {
        for (const account of accountsData) {
          // CREDIT CARD RULE: Never include in available balance
          if (account.account_type === 'credit_card') continue;
          
          // PRIORITY: Use official_balance from API if available (Open Finance accounts)
          if (account.official_balance !== null && account.official_balance !== undefined) {
            totalAccountBalance += Number(account.official_balance);
            linkedLocalAccountIds.add(account.id);
            continue;
          }
          
          // FALLBACK: Use calculate_account_balance for manual accounts
          const { data: balanceData } = await supabase.rpc("calculate_account_balance", {
            account_uuid: account.id,
          });
          totalAccountBalance += balanceData ?? Number(account.initial_balance) ?? 0;
        }
      }
      
      // Also include unlinked Open Finance accounts (bank type only, not credit cards)
      let ofQuery = supabase
        .from("open_finance_accounts")
        .select("balance, account_type, local_account_id");
      
      if (orgFilter.type === 'single') {
        ofQuery = ofQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        ofQuery = ofQuery.in("organization_id", orgFilter.ids);
      }
      
      const { data: ofAccounts } = await ofQuery;
      if (ofAccounts) {
        for (const ofa of ofAccounts) {
          // Skip credit cards and already-linked accounts
          if (ofa.account_type?.toUpperCase() === 'CREDIT') continue;
          if (ofa.local_account_id && linkedLocalAccountIds.has(ofa.local_account_id)) continue;
          // Only add unlinked OF accounts
          if (!ofa.local_account_id && ofa.balance) {
            totalAccountBalance += Number(ofa.balance);
          }
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
