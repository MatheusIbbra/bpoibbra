import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface CostCenter {
  id: string;
  user_id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useCostCenters() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["cost_centers", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async () => {
      let query = supabase
        .from("cost_centers")
        .select("*")
        .order("name");

      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CostCenter[];
    },
    enabled: !!user,
  });
}

export function useCreateCostCenter() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async (costCenter: { name: string; description?: string; is_active?: boolean }) => {
      const organizationId = getRequiredOrganizationId();
      
      if (!organizationId) {
        throw new Error("Selecione uma base antes de criar um centro de custo");
      }
      
      const { data, error } = await supabase
        .from("cost_centers")
        .insert({
          ...costCenter,
          user_id: user!.id,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_centers"] });
      toast.success("Centro de custo criado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao criar centro de custo: " + error.message);
    },
  });
}

export function useUpdateCostCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...costCenter }: Partial<CostCenter> & { id: string }) => {
      const { data, error } = await supabase
        .from("cost_centers")
        .update(costCenter)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_centers"] });
      toast.success("Centro de custo atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar centro de custo: " + error.message);
    },
  });
}

export function useDeleteCostCenter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cost_centers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost_centers"] });
      toast.success("Centro de custo excluído!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir centro de custo: " + error.message);
    },
  });
}
