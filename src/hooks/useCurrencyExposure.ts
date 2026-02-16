import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface CurrencyExposureData {
  total_patrimony: number;
  base_currency: string;
  exposures: Array<{
    currency: string;
    balance_original: number;
    balance_converted: number;
    account_count: number;
    percentage: number;
  }>;
  has_foreign_currency: boolean;
  generated_at: string;
}

export function useCurrencyExposure() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["currency-exposure", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<CurrencyExposureData | null> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return null;
      const { data, error } = await supabase.rpc("get_currency_exposure", {
        p_organization_id: orgFilter.ids[0],
      });
      if (error) { console.error("Currency exposure error:", error); return null; }
      return data as unknown as CurrencyExposureData;
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
    staleTime: 10 * 60 * 1000,
  });
}
