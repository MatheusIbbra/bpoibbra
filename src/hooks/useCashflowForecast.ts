import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface ForecastEntry {
  date: string;
  projected_balance: number;
  day: number;
  confidence: number;
}

export interface CashflowForecastData {
  current_balance: number;
  avg_daily_income: number;
  avg_daily_expense: number;
  net_daily: number;
  forecast: ForecastEntry[];
  generated_at: string;
}

export function useCashflowForecast() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["cashflow-forecast", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<CashflowForecastData | null> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return null;
      const orgId = orgFilter.ids[0];

      // Try materialized cache first
      const { data: cached } = await supabase
        .from("materialized_metrics")
        .select("data, computed_at, expires_at")
        .eq("organization_id", orgId)
        .eq("metric_type", "cashflow_forecast")
        .maybeSingle();

      if (cached && new Date(cached.expires_at) > new Date()) {
        return cached.data as unknown as CashflowForecastData;
      }

      // Fallback to live RPC
      const { data, error } = await supabase.rpc("generate_cashflow_forecast", {
        p_organization_id: orgId,
        p_days: 90,
      });

      if (error) {
        console.error("Error fetching forecast:", error);
        return null;
      }

      return data as unknown as CashflowForecastData;
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
    staleTime: 10 * 60 * 1000,
  });
}
