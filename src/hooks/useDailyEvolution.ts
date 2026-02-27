import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { startOfMonth, endOfMonth, format, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getLegacyInitialBalanceAdjustment } from "@/lib/legacy-initial-balance";

interface DailyData {
  day: string;
  dayLabel: string;
  income: number;
  expense: number;
  balance: number;
  cumulativeBalance: number;
}

type DailyInternal = DailyData & {
  investment: number;
  redemption: number;
};

export function useDailyEvolution(selectedMonth?: Date) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["daily-evolution", user?.id, orgFilter.type, orgFilter.ids, selectedMonth?.toISOString()],
    queryFn: async (): Promise<DailyData[]> => {
      const refDate = selectedMonth || new Date();
      const startDate = startOfMonth(refDate);
      const endDate = endOfMonth(refDate);

      // Initial balance from accounts is now handled as a transaction,
      // so we don't need to fetch initial_balance separately anymore.
      // This prevents double-counting.

      // Get all transactions before the start of the month to calculate opening balance
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
        .lte("date", format(endDate, "yyyy-MM-dd"))
        // Transfers are net-zero on consolidated balance, but we include
        // all types that affect cash balance.
        .in("type", ["income", "expense", "investment", "redemption"])
        .order("date", { ascending: true });

      // Apply organization filter
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data: transactions, error } = await query;

      if (error) throw error;

      // Initialize daily data for all days of the month
      const allDays = eachDayOfInterval({ start: startDate, end: endDate });
      const dailyMap = new Map<string, DailyInternal>();
      
      allDays.forEach((date) => {
        const dayKey = format(date, "yyyy-MM-dd");
        const dayLabel = format(date, "dd", { locale: ptBR });
        
        dailyMap.set(dayKey, {
          day: dayKey,
          dayLabel,
          income: 0,
          expense: 0,
          balance: 0,
          cumulativeBalance: 0,
          investment: 0,
          redemption: 0,
        });
      });

      // Aggregate transactions
      transactions?.forEach((tx) => {
        const dayData = dailyMap.get(tx.date);
        
        if (!dayData) return;
        const amount = Number(tx.amount);
        if (tx.type === "income") dayData.income += amount;
        if (tx.type === "expense") dayData.expense += amount;
        if (tx.type === "investment") dayData.investment += amount;
        if (tx.type === "redemption") dayData.redemption += amount;
      });

      // Net flow for each day (used for cumulative balance)
      dailyMap.forEach((d) => {
        d.balance = d.income + d.redemption - d.expense - d.investment;
      });

      // Calculate cumulative balance
      let runningBalance = openingBalance;
      const result = Array.from(dailyMap.values());
      result.forEach((day) => {
        runningBalance += day.balance;
        day.cumulativeBalance = runningBalance;
      });

      return result.map(({ investment: _i, redemption: _r, ...rest }) => rest);
    },
    enabled: !!user,
  });
}
