import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface CurrencyBalance {
  currency: string;
  balance: number;
  converted_balance: number | null;
  account_count: number;
}

export interface ExchangeRateUsed {
  from: string;
  to: string;
  rate: number;
}

export interface ConsolidatedBalanceData {
  total_converted: number;
  target_currency: string;
  by_currency: CurrencyBalance[];
  rates_used: ExchangeRateUsed[];
  generated_at: string;
}

export function useConsolidatedBalance() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["consolidated-balance", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<ConsolidatedBalanceData | null> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return null;

      const { data, error } = await supabase.rpc("get_consolidated_balance", {
        p_organization_id: orgFilter.ids[0],
      });

      if (error) {
        console.error("Error fetching consolidated balance:", error);
        return null;
      }

      return data as unknown as ConsolidatedBalanceData;
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
    staleTime: 2 * 60 * 1000,
  });
}
