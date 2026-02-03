import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface ReconciliationRule {
  id: string;
  organization_id: string;
  user_id: string;
  description: string;
  amount: number;
  due_day: number | null;
  category_id: string | null;
  cost_center_id: string | null;
  transaction_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateReconciliationRuleData {
  description: string;
  amount: number;
  due_day?: number | null;
  category_id?: string | null;
  cost_center_id?: string | null;
  transaction_type: string;
}

export function useReconciliationRules() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["reconciliation-rules", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async () => {
      let query = supabase
        .from("reconciliation_rules")
        .select("*")
        .eq("is_active", true)
        .order("description", { ascending: true });

      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ReconciliationRule[];
    },
    enabled: !!user,
  });
}

export function useCreateReconciliationRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async (data: CreateReconciliationRuleData) => {
      if (!user) throw new Error("Usuário não autenticado");
      
      const organizationId = getRequiredOrganizationId();
      if (!organizationId) {
        throw new Error("Selecione uma base antes de criar uma regra");
      }

      const { data: result, error } = await supabase
        .from("reconciliation_rules")
        .insert({
          ...data,
          organization_id: organizationId,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-rules"] });
      toast.success("Regra de conciliação criada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar regra: ${error.message}`);
    },
  });
}

export function useUpdateReconciliationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ReconciliationRule> & { id: string }) => {
      const { data: result, error } = await supabase
        .from("reconciliation_rules")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-rules"] });
      toast.success("Regra atualizada com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar regra: ${error.message}`);
    },
  });
}

export function useDeleteReconciliationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("reconciliation_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-rules"] });
      toast.success("Regra excluída com sucesso!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir regra: ${error.message}`);
    },
  });
}
