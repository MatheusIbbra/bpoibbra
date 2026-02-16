import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface LifestylePatternData {
  avg_monthly_12m: number;
  avg_monthly_3m: number;
  volatility: number;
  trend: string;
  monthly_data: Array<{ month: string; total: number }>;
  generated_at: string;
}

export function useLifestylePattern() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["lifestyle-pattern", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<LifestylePatternData | null> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return null;
      const { data, error } = await supabase.rpc("get_lifestyle_pattern", {
        p_organization_id: orgFilter.ids[0],
      });
      if (error) { console.error("Lifestyle pattern error:", error); return null; }
      return data as unknown as LifestylePatternData;
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
    staleTime: 10 * 60 * 1000,
  });
}
