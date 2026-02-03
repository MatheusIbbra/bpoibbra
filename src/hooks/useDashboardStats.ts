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
      
      // Build base query for transactions
      const buildTransactionQuery = (start: string, end: string) => {
        let query = supabase
          .from("transactions")
          .select("amount, type")
          .gte("date", start)
          .lte("date", end);
        
        // Aplicar filtro de organização
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
      
      // Get total balance from accounts
      let accountsQuery = supabase
        .from("accounts")
        .select("id, initial_balance");
      
      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        accountsQuery = accountsQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        accountsQuery = accountsQuery.in("organization_id", orgFilter.ids);
      }
      
      const { data: accountsData } = await accountsQuery;
      
      let totalAccountBalance = 0;
      if (accountsData) {
        for (const account of accountsData) {
          const { data: balanceData } = await supabase.rpc("calculate_account_balance", {
            account_uuid: account.id,
          });
          totalAccountBalance += balanceData ?? account.initial_balance;
        }
      }
      
      const calculateTotals = (data: { amount: number; type: string }[] | null) => {
        if (!data) return { income: 0, expenses: 0 };
        return data.reduce(
          (acc, t) => {
            if (t.type === "income") {
              acc.income += Number(t.amount);
            } else {
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
