import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface PersonalRunwayData {
  runway_months: number;
  liquid_assets: number;
  avg_monthly_expense: number;
  risk_level: string;
  generated_at: string;
}

export function usePersonalRunway() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["personal-runway", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<PersonalRunwayData | null> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return null;
      const { data, error } = await supabase.rpc("get_personal_runway", {
        p_organization_id: orgFilter.ids[0],
      });
      if (error) { console.error("Personal runway error:", error); return null; }
      return data as unknown as PersonalRunwayData;
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
    staleTime: 10 * 60 * 1000,
  });
}
