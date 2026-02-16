import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface BankConcentrationData {
  total_patrimony: number;
  banks: Array<{
    bank_name: string;
    balance: number;
    account_count: number;
    percentage: number;
  }>;
  max_concentration_pct: number;
  risk_level: string;
  generated_at: string;
}

export function useBankConcentration() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["bank-concentration", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<BankConcentrationData | null> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return null;
      const { data, error } = await supabase.rpc("get_bank_concentration", {
        p_organization_id: orgFilter.ids[0],
      });
      if (error) { console.error("Bank concentration error:", error); return null; }
      return data as unknown as BankConcentrationData;
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
    staleTime: 10 * 60 * 1000,
  });
}
