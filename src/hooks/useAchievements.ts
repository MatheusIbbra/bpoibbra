import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface Achievement {
  id: string;
  user_id: string;
  organization_id: string;
  achievement_key: string;
  achieved_at: string;
  metadata: Record<string, any>;
}

export const ACHIEVEMENT_DEFINITIONS: Record<string, { label: string; description: string; icon: string; color: string }> = {
  primeiro_orcamento: {
    label: "Primeiro Orçamento",
    description: "Criou o primeiro orçamento",
    icon: "🎯",
    color: "hsl(210, 100%, 36%)",
  },
  mes_no_verde: {
    label: "Mês no Verde",
    description: "Terminou um mês sem estourar nenhuma categoria",
    icon: "✅",
    color: "hsl(160, 60%, 36%)",
  },
  investidor_10: {
    label: "Investidor 10%",
    description: "Taxa de aporte ≥ 10% da receita em um mês",
    icon: "📈",
    color: "hsl(38, 92%, 50%)",
  },
  investidor_20: {
    label: "Investidor 20%",
    description: "Taxa de aporte ≥ 20% da receita em um mês",
    icon: "🚀",
    color: "hsl(14, 100%, 54%)",
  },
  streak_3: {
    label: "Streak de 3",
    description: "3 meses consecutivos dentro do orçamento",
    icon: "🔥",
    color: "hsl(14, 100%, 54%)",
  },
  base_zero: {
    label: "Base Zero",
    description: "Criou um plano de base zero completo",
    icon: "💎",
    color: "hsl(213, 80%, 13%)",
  },
};

export function useAchievements() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["achievements", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async () => {
      let query = supabase
        .from("user_achievements")
        .select("*")
        .order("achieved_at", { ascending: true });

      if (orgFilter.type === "single") {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Achievement[];
    },
    enabled: !!user,
  });
}

export function useUnlockAchievement() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async (achievementKey: string) => {
      const organizationId = getRequiredOrganizationId();
      if (!organizationId || !user) throw new Error("Missing context");

      const { data, error } = await supabase
        .from("user_achievements")
        .upsert(
          {
            user_id: user.id,
            organization_id: organizationId,
            achievement_key: achievementKey,
            achieved_at: new Date().toISOString(),
          },
          { onConflict: "user_id,organization_id,achievement_key" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, key) => {
      queryClient.invalidateQueries({ queryKey: ["achievements"] });
      const def = ACHIEVEMENT_DEFINITIONS[key];
      if (def) {
        toast.success(`🏆 Conquista desbloqueada: ${def.label}!`, {
          description: def.description,
          duration: 5000,
        });
      }
    },
  });
}
