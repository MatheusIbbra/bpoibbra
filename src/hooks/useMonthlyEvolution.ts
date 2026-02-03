import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { startOfMonth, subMonths, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getLegacyInitialBalanceAdjustment } from "@/lib/legacy-initial-balance";

interface MonthlyData {
  month: string;
  monthLabel: string;
  income: number;
  expense: number;
  balance: number;
  cumulativeBalance: number;
}

type MonthlyInternal = MonthlyData & {
  investment: number;
  redemption: number;
};

export function useMonthlyEvolution(months: number = 6) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["monthly-evolution", user?.id, orgFilter.type, orgFilter.ids, months],
    queryFn: async (): Promise<MonthlyData[]> => {
      const today = new Date();
      const startDate = startOfMonth(subMonths(today, months - 1));

      // Initial balance from accounts is now handled as a transaction,
      // so we don't need to fetch initial_balance separately anymore.
      // This prevents double-counting.

      // Get all transactions before the start of the period to calculate opening balance
      let priorQuery = supabase
        .from("transactions")
        .select("amount, type")
        .lt("date", format(startDate, "yyyy-MM-dd"))
        .in("type", ["income", "expense", "investment", "redemption"]);
      
      if (orgFilter.type === 'single') {
        priorQuery = priorQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        priorQuery = priorQuery.in("organization_id", orgFilter.ids);
      }
      
      const { data: priorTransactions } = await priorQuery;
      
      // Opening balance: income + redemptions - expense - investments
      let openingBalance = 0;
      priorTransactions?.forEach((tx) => {
        const amount = parseFloat(String(tx.amount));
        if (tx.type === "income" || tx.type === "redemption") {
          openingBalance += amount;
        } else if (tx.type === "expense" || tx.type === "investment") {
          openingBalance -= amount;
        }
      });

      // Add legacy account initial balances (accounts without initial tx)
      openingBalance += await getLegacyInitialBalanceAdjustment({
        orgFilter: orgFilter as any,
        beforeDate: format(startDate, "yyyy-MM-dd"),
      });

      let query = supabase
        .from("transactions")
        .select("date, amount, type")
        .gte("date", format(startDate, "yyyy-MM-dd"))
        // Transfers are net-zero on consolidated balance, but we include
        // all types that affect cash balance.
        .in("type", ["income", "expense", "investment", "redemption"])
        .order("date", { ascending: true });

      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      // Initialize monthly data
      const monthlyMap = new Map<string, MonthlyInternal>();
      
      for (let i = 0; i < months; i++) {
        const date = subMonths(today, months - 1 - i);
        const monthKey = format(date, "yyyy-MM");
        const monthLabel = format(date, "MMM", { locale: ptBR });
        
        monthlyMap.set(monthKey, {
          month: monthKey,
          monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          income: 0,
          expense: 0,
          balance: 0,
          cumulativeBalance: 0,
          investment: 0,
          redemption: 0,
        });
      }

      // Aggregate transactions
      transactions?.forEach((tx) => {
        const monthKey = tx.date.substring(0, 7);
        const monthData = monthlyMap.get(monthKey);
        
        if (!monthData) return;

        const amount = Number(tx.amount);
        if (tx.type === "income") monthData.income += amount;
        if (tx.type === "expense") monthData.expense += amount;
        if (tx.type === "investment") monthData.investment += amount;
        if (tx.type === "redemption") monthData.redemption += amount;
      });

      // Compute net flow for each month (used for cumulative balance)
      monthlyMap.forEach((m) => {
        m.balance = m.income + m.redemption - m.expense - m.investment;
      });

      // Calculate cumulative balance
      let runningBalance = openingBalance;
      const result = Array.from(monthlyMap.values());
      result.forEach((month) => {
        runningBalance += month.balance;
        month.cumulativeBalance = runningBalance;
      });

      // Return only the public shape
      return result.map(({ investment: _i, redemption: _r, ...rest }) => rest);
    },
    enabled: !!user,
  });
}
