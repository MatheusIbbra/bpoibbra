import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface StructuredLiquidityData {
  immediate: number;
  liquidity_30d: number;
  liquidity_90d: number;
  committed_capital: number;
  total_patrimony: number;
  immediate_pct: number;
  generated_at: string;
}

export function useStructuredLiquidity() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["structured-liquidity", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<StructuredLiquidityData | null> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return null;
      const { data, error } = await supabase.rpc("get_structured_liquidity", {
        p_organization_id: orgFilter.ids[0],
      });
      if (error) { console.error("Structured liquidity error:", error); return null; }
      return data as unknown as StructuredLiquidityData;
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
    staleTime: 10 * 60 * 1000,
  });
}
