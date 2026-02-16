import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface PatrimonyEvolutionData {
  current_patrimony: number;
  estimated_12m_ago: number;
  growth_pct: number;
  monthly_data: Array<{
    month: string;
    income: number;
    expense: number;
    net_flow: number;
    cumulative_net: number;
  }>;
  generated_at: string;
}

export function usePatrimonyEvolution() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["patrimony-evolution", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<PatrimonyEvolutionData | null> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return null;
      const { data, error } = await supabase.rpc("get_patrimony_evolution", {
        p_organization_id: orgFilter.ids[0],
      });
      if (error) { console.error("Patrimony evolution error:", error); return null; }
      return data as unknown as PatrimonyEvolutionData;
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
    staleTime: 10 * 60 * 1000,
  });
}
