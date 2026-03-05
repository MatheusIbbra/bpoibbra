import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface UserClassificationRule {
  id: string;
  user_id: string;
  organization_id: string | null;
  keyword: string;
  category_id: string | null;
  cost_center_id: string | null;
  transaction_type: "income" | "expense";
  match_exact: boolean;
  priority: number;
  created_at: string;
}

export function useUserClassificationRules() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["user-classification-rules", user?.id, orgFilter.ids],
    queryFn: async (): Promise<UserClassificationRule[]> => {
      let query = supabase
        .from("user_classification_rules" as any)
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (orgFilter.type === "single") {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === "multiple" && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as UserClassificationRule[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateUserClassificationRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async (rule: {
      keyword: string;
      category_id: string;
      cost_center_id?: string | null;
      transaction_type: "income" | "expense";
      match_exact?: boolean;
    }) => {
      const organizationId = getRequiredOrganizationId();
      const { data, error } = await supabase
        .from("user_classification_rules" as any)
        .insert({
          ...rule,
          user_id: user!.id,
          organization_id: organizationId,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-classification-rules"] });
      toast.success("Regra de classificação salva!");
    },
    onError: (e: Error) => toast.error("Erro ao salvar regra: " + e.message),
  });
}

export function useDeleteUserClassificationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_classification_rules" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-classification-rules"] });
      toast.success("Regra removida");
    },
    onError: (e: Error) => toast.error("Erro ao remover regra: " + e.message),
  });
}
