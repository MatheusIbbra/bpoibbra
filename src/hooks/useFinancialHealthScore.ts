import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface FinancialHealthData {
  score: number;
  runway_months: number;
  burn_rate: number;
  savings_rate: number;
  total_balance: number;
  total_revenue: number;
  total_expenses: number;
  expense_concentration: number;
  revenue_growth: number;
  expense_growth: number;
}

export function useFinancialHealthScore() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["financial-health-score", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<FinancialHealthData | null> => {
      if (orgFilter.type !== 'single' || !orgFilter.ids[0]) return null;

      const { data, error } = await supabase.rpc("generate_financial_health_score", {
        p_organization_id: orgFilter.ids[0],
      });

      if (error) {
        console.error("Error fetching health score:", error);
        return null;
      }

      return data as unknown as FinancialHealthData;
    },
    enabled: !!user && orgFilter.type === 'single' && !!orgFilter.ids[0],
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
