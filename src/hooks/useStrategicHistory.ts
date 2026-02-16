import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface StrategicSnapshot {
  id: string;
  organization_id: string;
  snapshot_month: string;
  financial_health_score: number | null;
  runway_months: number | null;
  burn_rate: number | null;
  savings_rate: number | null;
  total_balance: number;
  total_revenue: number;
  total_expenses: number;
  bank_concentration_max_pct: number | null;
  bank_concentration_risk: string | null;
  currency_exposure: any[];
  has_foreign_currency: boolean;
  liquidity_immediate: number;
  liquidity_30d: number;
  liquidity_90d: number;
  committed_capital: number;
  lifestyle_avg_monthly: number;
  lifestyle_trend: string;
  lifestyle_volatility: number;
  ai_insights: any | null;
  created_at: string;
}

export function useStrategicHistory() {
  const { user } = useAuth();
  const { getOrganizationFilter, getRequiredOrganizationId } = useBaseFilter();
  const orgFilter = getOrganizationFilter();
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ["strategic-history", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async (): Promise<StrategicSnapshot[]> => {
      if (orgFilter.type !== "single" || !orgFilter.ids[0]) return [];

      const { data, error } = await supabase
        .from("strategic_history")
        .select("*")
        .eq("organization_id", orgFilter.ids[0])
        .order("snapshot_month", { ascending: true })
        .limit(24);

      if (error) throw error;
      return (data || []) as unknown as StrategicSnapshot[];
    },
    enabled: !!user && orgFilter.type === "single" && !!orgFilter.ids[0],
    staleTime: 10 * 60 * 1000,
  });

  const generateSnapshot = useMutation({
    mutationFn: async () => {
      const organizationId = getRequiredOrganizationId();
      if (!organizationId) throw new Error("Selecione uma base");

      const { data, error } = await supabase.rpc("generate_strategic_snapshot", {
        p_organization_id: organizationId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategic-history"] });
      toast.success("Snapshot estratégico salvo com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao gerar snapshot: " + error.message);
    },
  });

  return {
    history: historyQuery.data || [],
    isLoading: historyQuery.isLoading,
    generateSnapshot,
  };
}
