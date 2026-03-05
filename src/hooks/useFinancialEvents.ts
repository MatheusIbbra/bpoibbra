import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export type FinancialEventType =
  | "income"
  | "expense"
  | "internal_transfer"
  | "investment_contribution"
  | "investment_withdraw"
  | "loan_payment"
  | "credit_card_payment";

export interface FinancialEvent {
  id: string;
  transaction_id: string;
  organization_id: string;
  event_type: FinancialEventType;
  amount: number;
  source_account_id: string | null;
  destination_account_id: string | null;
  impact_cashflow: boolean;
  impact_investments: boolean;
  event_date: string;
  created_at: string;
}

export interface FinancialEventsSummary {
  totalIncome: number;
  totalExpenses: number;
  totalInvestments: number;   // sum of investment_contribution
  totalRedemptions: number;   // sum of investment_withdraw
  netCashflow: number;        // income - expenses
  netInvestmentBalance: number; // contributions - withdrawals
}

interface UseFinancialEventsOptions {
  startDate?: string;
  endDate?: string;
  eventTypes?: FinancialEventType[];
}

/**
 * Hook to query financial_events — the canonical source of financial truth.
 * Excludes internal_transfers from all cashflow calculations.
 */
export function useFinancialEvents(options?: UseFinancialEventsOptions) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["financial-events", user?.id, orgFilter.type, orgFilter.ids, options],
    queryFn: async (): Promise<FinancialEvent[]> => {
      let query = supabase
        .from("financial_events" as any)
        .select("*")
        .order("event_date", { ascending: false });

      if (orgFilter.type === "single") {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      if (options?.startDate) query = query.gte("event_date", options.startDate);
      if (options?.endDate)   query = query.lte("event_date", options.endDate);
      if (options?.eventTypes?.length) query = query.in("event_type", options.eventTypes);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((e: any) => ({ ...e, amount: Number(e.amount) }));
    },
    enabled: !!user,
    staleTime: 30_000, // 30s – financial data changes frequently
  });
}

/**
 * Returns aggregated summary from financial_events for a given month.
 * This is the single correct source for dashboard KPIs.
 */
export function useFinancialEventsSummary(startDate: string, endDate: string): {
  data: FinancialEventsSummary | null;
  isLoading: boolean;
} {
  const { data, isLoading } = useFinancialEvents({ startDate, endDate });

  if (isLoading || !data) return { data: null, isLoading };

  const summary = data.reduce<FinancialEventsSummary>(
    (acc, ev) => {
      switch (ev.event_type) {
        case "income":
          acc.totalIncome += ev.amount;
          acc.netCashflow += ev.amount;
          break;
        case "expense":
        case "loan_payment":
        case "credit_card_payment":
          acc.totalExpenses += ev.amount;
          acc.netCashflow -= ev.amount;
          break;
        case "investment_contribution":
          acc.totalInvestments += ev.amount;
          acc.netInvestmentBalance += ev.amount;
          break;
        case "investment_withdraw":
          acc.totalRedemptions += ev.amount;
          acc.netInvestmentBalance -= ev.amount;
          break;
        case "internal_transfer":
          // intentionally no impact
          break;
      }
      return acc;
    },
    {
      totalIncome: 0,
      totalExpenses: 0,
      totalInvestments: 0,
      totalRedemptions: 0,
      netCashflow: 0,
      netInvestmentBalance: 0,
    }
  );

  return { data: summary, isLoading: false };
}
