import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export type FeatureKey =
  | "strategic_insights"
  | "macro_simulation"
  | "strategic_history"
  | "anomaly_detection"
  | "cashflow_forecast"
  | "bank_concentration"
  | "currency_exposure"
  | "financial_simulator"
  | "data_export"
  | "internal_comments"
  | "detailed_metrics"
  | "comparative_history";

export function useFeatureFlags() {
  const { user } = useAuth();
  const { selectedOrganizationId } = useBaseFilter();

  const query = useQuery({
    queryKey: ["feature-flags", user?.id, selectedOrganizationId],
    queryFn: async (): Promise<Record<string, boolean>> => {
      if (!selectedOrganizationId || selectedOrganizationId === "all") return {};

      const { data, error } = await supabase.rpc("get_user_features", {
        p_organization_id: selectedOrganizationId,
      });

      if (error) {
        console.warn("Error fetching feature flags:", error);
        return {};
      }

      return (data as Record<string, boolean>) || {};
    },
    enabled: !!user && !!selectedOrganizationId && selectedOrganizationId !== "all",
    staleTime: 5 * 60 * 1000,
  });

  const hasFeature = (key: FeatureKey): boolean => {
    if (!query.data) return false;
    return query.data[key] === true;
  };

  return {
    features: query.data || {},
    isLoading: query.isLoading,
    hasFeature,
  };
}
