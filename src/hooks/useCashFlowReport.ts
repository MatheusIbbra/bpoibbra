import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, parseISO } from "date-fns";
import { getLegacyInitialBalanceAdjustment } from "@/lib/legacy-initial-balance";

export type ReportBasis = "cash" | "accrual";
export type Granularity = "daily" | "weekly" | "monthly";

interface CashFlowPeriod {
  period: string;
  inflows: number;
  outflows: number;
  investments: number;
  redemptions: number;
  netFlow: number;
  cumulativeBalance: number;
}

interface CashFlowData {
  periods: CashFlowPeriod[];
  totalInflows: number;
  totalOutflows: number;
  totalInvestments: number;
  totalRedemptions: number;
  netCashFlow: number;
  openingBalance: number;
  closingBalance: number;
}

export function useCashFlowReport(
  startDate: Date, 
  endDate: Date, 
  basis: ReportBasis,
  granularity: Granularity = "daily"
) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const dateField = basis === "cash" ? "date" : "accrual_date";

  return useQuery({
    queryKey: ["cashflow-report", user?.id, orgFilter.type, orgFilter.ids, format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), basis, granularity],
    queryFn: async (): Promise<CashFlowData> => {
      // Initial balance from accounts is now handled as a transaction,
      // so we don't need to fetch initial_balance separately anymore.
      // This prevents double-counting.

      // Get transactions for the period
      let transactionsQuery = supabase
        .from("transactions")
        .select("id, amount, type, date")
        .gte(dateField, format(startDate, "yyyy-MM-dd"))
        .lte(dateField, format(endDate, "yyyy-MM-dd"))
        .order("date", { ascending: true });

      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        transactionsQuery = transactionsQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        transactionsQuery = transactionsQuery.in("organization_id", orgFilter.ids);
      }

      const { data: transactions, error } = await transactionsQuery;

      if (error) throw error;

      // Get opening balance (sum of transactions before start date)
      let priorQuery = supabase
        .from("transactions")
        .select("amount, type")
        .lt(dateField, format(startDate, "yyyy-MM-dd"));

      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        priorQuery = priorQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        priorQuery = priorQuery.in("organization_id", orgFilter.ids);
      }

      const { data: priorTransactions } = await priorQuery;

      // Opening balance is now calculated purely from prior transactions
      // (initial balances are already recorded as transactions)
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

      // Group transactions by period
      const getPeriods = () => {
        switch (granularity) {
          case "daily":
            return eachDayOfInterval({ start: startDate, end: endDate }).map(d => ({
              start: d,
              label: format(d, "dd/MM/yyyy")
            }));
          case "weekly":
            return eachWeekOfInterval({ start: startDate, end: endDate }).map(d => ({
              start: d,
              label: `Sem ${format(d, "dd/MM")}`
            }));
          case "monthly":
            return eachMonthOfInterval({ start: startDate, end: endDate }).map(d => ({
              start: d,
              label: format(d, "MMM/yyyy")
            }));
        }
      };

      const periods = getPeriods();
      const periodData: CashFlowPeriod[] = [];
      let cumulative = openingBalance;
      let totalInflows = 0;
      let totalOutflows = 0;
      let totalInvestments = 0;
      let totalRedemptions = 0;

      periods.forEach((period, index) => {
        const nextPeriod = periods[index + 1];
        const periodEnd = nextPeriod ? nextPeriod.start : endDate;
        
        const periodTransactions = transactions?.filter((tx) => {
          const txDate = new Date(tx.date);
          return txDate >= period.start && txDate < periodEnd;
        }) || [];

        let inflows = 0;
        let outflows = 0;
        let investments = 0;
        let redemptions = 0;

        periodTransactions.forEach((tx) => {
          const amount = Number(tx.amount);
          switch (tx.type) {
            case "income":
              inflows += amount;
              totalInflows += amount;
              break;
            case "expense":
              outflows += amount;
              totalOutflows += amount;
              break;
            case "investment":
              investments += amount;
              totalInvestments += amount;
              break;
            case "redemption":
              redemptions += amount;
              totalRedemptions += amount;
              break;
          }
        });

        const netFlow = inflows + redemptions - outflows - investments;
        cumulative += netFlow;

        periodData.push({
          period: period.label,
          inflows,
          outflows,
          investments,
          redemptions,
          netFlow,
          cumulativeBalance: cumulative,
        });
      });

      const netCashFlow = totalInflows + totalRedemptions - totalOutflows - totalInvestments;

      return {
        periods: periodData,
        totalInflows,
        totalOutflows,
        totalInvestments,
        totalRedemptions,
        netCashFlow,
        openingBalance,
        closingBalance: openingBalance + netCashFlow,
      };
    },
    enabled: !!user,
  });
}
