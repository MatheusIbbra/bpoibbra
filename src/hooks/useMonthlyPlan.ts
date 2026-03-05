import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface MonthlyPlan {
  id: string;
  organization_id: string;
  user_id: string;
  month: number;
  year: number;
  income_target: number;
  investment_target: number;
  created_at: string;
  updated_at: string;
}

export function useMonthlyPlan(month: number, year: number) {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["monthly-plan", user?.id, orgFilter.type, orgFilter.ids, month, year],
    queryFn: async () => {
      let query = supabase
        .from("monthly_plans")
        .select("*")
        .eq("month", month)
        .eq("year", year);

      if (orgFilter.type === "single") {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as MonthlyPlan | null;
    },
    enabled: !!user,
  });
}

export function useUpsertMonthlyPlan() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async (plan: {
      month: number;
      year: number;
      income_target: number;
      investment_target: number;
    }) => {
      if (!user) throw new Error("Sessão expirada. Faça login novamente.");

      const organizationId = getRequiredOrganizationId();
      if (!organizationId) throw new Error("Selecione uma base");

      const { data, error } = await supabase
        .from("monthly_plans")
        .upsert(
          {
            organization_id: organizationId,
            user_id: user!.id,
            month: plan.month,
            year: plan.year,
            income_target: plan.income_target,
            investment_target: plan.investment_target,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,month,year" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["monthly-plan"] });
      toast.success("Plano do mês salvo!");
    },
    onError: (error) => {
      toast.error("Erro ao salvar plano: " + error.message);
    },
  });
}
