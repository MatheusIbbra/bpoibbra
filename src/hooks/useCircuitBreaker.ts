import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface CircuitBreakerState {
  id: string;
  provider: string;
  organization_id: string;
  state: "closed" | "open" | "half_open";
  failure_count: number;
  opened_at: string | null;
  updated_at: string;
}

export function useCircuitBreaker() {
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["circuit-breaker", orgFilter.ids],
    queryFn: async () => {
      let query = supabase
        .from("circuit_breaker_state")
        .select("*")
        .eq("state", "open");

      if (orgFilter.type === "single") {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CircuitBreakerState[];
    },
    refetchInterval: 30000, // Poll every 30s
  });
}
