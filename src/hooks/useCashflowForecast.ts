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

      const { data, error } = await supabase.rpc("generate_cashflow_forecast", {
        p_organization_id: orgFilter.ids[0],
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
