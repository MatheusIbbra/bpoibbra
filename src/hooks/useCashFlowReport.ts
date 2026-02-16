import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { getLegacyInitialBalanceAdjustment } from "@/lib/legacy-initial-balance";
import { parseLocalDate } from "@/lib/formatters";

export type ReportBasis = "cash" | "accrual";
export type Granularity = "daily" | "weekly" | "monthly";

// Only these account types are considered for cash flow
const CASHFLOW_ACCOUNT_TYPES = ['checking', 'savings', 'investment', 'cash'] as const;

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
  granularity: Granularity = "daily",
  costCenterId?: string
) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const startStr = format(startDate, "yyyy-MM-dd");
  const endStr = format(endDate, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["cashflow-report", user?.id, orgFilter.type, orgFilter.ids, startStr, endStr, basis, granularity, costCenterId],
    queryFn: async (): Promise<CashFlowData> => {
      // Step 1: Get IDs of allowed accounts (checking, savings, investment, cash only)
      let accountsQuery = supabase
        .from("accounts")
        .select("id")
        .in("account_type", [...CASHFLOW_ACCOUNT_TYPES]);

      if (orgFilter.type === 'single') {
        accountsQuery = accountsQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        accountsQuery = accountsQuery.in("organization_id", orgFilter.ids);
      }

      const { data: allowedAccounts } = await accountsQuery;
      const allowedAccountIds = allowedAccounts?.map(a => a.id) || [];

      // If no valid accounts, return empty data
      if (allowedAccountIds.length === 0) {
        const openingBalance = await getLegacyInitialBalanceAdjustment({
          orgFilter: orgFilter as any,
          beforeDate: startStr,
        });
        return {
          periods: [],
          totalInflows: 0,
          totalOutflows: 0,
          totalInvestments: 0,
          totalRedemptions: 0,
          netCashFlow: 0,
          openingBalance,
          closingBalance: openingBalance,
        };
      }

      // Step 2: Get transactions ONLY from allowed accounts
      let transactionsQuery = supabase
        .from("transactions")
        .select("id, amount, type, date, accrual_date")
        .in("account_id", allowedAccountIds)
        .neq("is_ignored", true)
        .order("date", { ascending: true });

      if (basis === "cash") {
        transactionsQuery = transactionsQuery.gte("date", startStr).lte("date", endStr);
      } else {
        transactionsQuery = transactionsQuery.or(
          `and(accrual_date.gte.${startStr},accrual_date.lte.${endStr}),and(accrual_date.is.null,date.gte.${startStr},date.lte.${endStr})`
        );
      }

      if (orgFilter.type === 'single') {
        transactionsQuery = transactionsQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        transactionsQuery = transactionsQuery.in("organization_id", orgFilter.ids);
      }

      if (costCenterId) {
        transactionsQuery = transactionsQuery.eq("cost_center_id", costCenterId);
      }

      const { data: transactions, error } = await transactionsQuery;
      if (error) throw error;

      // Step 3: Get opening balance (prior transactions from allowed accounts only)
      let priorQuery = supabase
        .from("transactions")
        .select("amount, type, accrual_date")
        .in("account_id", allowedAccountIds)
        .neq("is_ignored", true);

      if (basis === "cash") {
        priorQuery = priorQuery.lt("date", startStr);
      } else {
        priorQuery = priorQuery.or(
          `and(accrual_date.lt.${startStr}),and(accrual_date.is.null,date.lt.${startStr})`
        );
      }

      if (orgFilter.type === 'single') {
        priorQuery = priorQuery.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        priorQuery = priorQuery.in("organization_id", orgFilter.ids);
      }

      if (costCenterId) {
        priorQuery = priorQuery.eq("cost_center_id", costCenterId);
      }

      const { data: priorTransactions } = await priorQuery;

      let openingBalance = 0;
      priorTransactions?.forEach((tx) => {
        const amount = parseFloat(String(tx.amount));
        if (tx.type === "income" || tx.type === "redemption") {
          openingBalance += amount;
        } else if (tx.type === "expense" || tx.type === "investment") {
          openingBalance -= amount;
        } else if (tx.type === "transfer") {
          openingBalance -= amount;
        }
      });

      // Add legacy account initial balances
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
          const txDate = parseLocalDate(tx.date);
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
            case "transfer":
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