import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface FinancialEntity {
  id: string;
  organization_id: string;
  name: string;
  entity_type: "pf" | "holding" | "empresa";
  parent_entity_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useFinancialEntities() {
  const { user } = useAuth();
  const { selectedOrganizationId: selectedBaseId } = useBaseFilter();
  const queryClient = useQueryClient();

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ["financial-entities", selectedBaseId],
    queryFn: async () => {
      if (!selectedBaseId) return [];
      const { data, error } = await supabase
        .from("financial_entities")
        .select("*")
        .eq("organization_id", selectedBaseId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as FinancialEntity[];
    },
    enabled: !!user && !!selectedBaseId,
  });

  const createEntity = useMutation({
    mutationFn: async (entity: { name: string; entity_type: string; parent_entity_id?: string | null; description?: string }) => {
      if (!selectedBaseId) throw new Error("Nenhuma base selecionada");
      const { data, error } = await supabase
        .from("financial_entities")
        .insert({ ...entity, organization_id: selectedBaseId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entities"] });
      toast.success("Entidade criada com sucesso");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEntity = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FinancialEntity> & { id: string }) => {
      const { error } = await supabase.from("financial_entities").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entities"] });
      toast.success("Entidade atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEntity = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_entities").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entities"] });
      toast.success("Entidade removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { entities, isLoading, createEntity, updateEntity, deleteEntity };
}
