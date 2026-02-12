import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface PatrimonyLiability {
  id: string;
  entity_id: string;
  organization_id: string;
  liability_type: "emprestimo" | "financiamento" | "divida" | "outro";
  description: string;
  current_value: number;
  reference_date: string;
  notes: string | null;
  created_at: string;
}

export function usePatrimonyLiabilities(entityId?: string) {
  const { user } = useAuth();
  const { selectedOrganizationId: selectedBaseId } = useBaseFilter();
  const queryClient = useQueryClient();

  const { data: liabilities = [], isLoading } = useQuery({
    queryKey: ["patrimony-liabilities", selectedBaseId, entityId],
    queryFn: async () => {
      if (!selectedBaseId) return [];
      let query = supabase.from("patrimony_liabilities").select("*").eq("organization_id", selectedBaseId);
      if (entityId) query = query.eq("entity_id", entityId);
      const { data, error } = await query.order("current_value", { ascending: false });
      if (error) throw error;
      return data as PatrimonyLiability[];
    },
    enabled: !!user && !!selectedBaseId,
  });

  const createLiability = useMutation({
    mutationFn: async (liability: Omit<PatrimonyLiability, "id" | "organization_id" | "created_at">) => {
      if (!selectedBaseId) throw new Error("Nenhuma base selecionada");
      const { data, error } = await supabase
        .from("patrimony_liabilities")
        .insert({ ...liability, organization_id: selectedBaseId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimony-liabilities"] });
      queryClient.invalidateQueries({ queryKey: ["patrimony-consolidation"] });
      toast.success("Passivo adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLiability = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PatrimonyLiability> & { id: string }) => {
      const { error } = await supabase.from("patrimony_liabilities").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimony-liabilities"] });
      queryClient.invalidateQueries({ queryKey: ["patrimony-consolidation"] });
      toast.success("Passivo atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLiability = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patrimony_liabilities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimony-liabilities"] });
      queryClient.invalidateQueries({ queryKey: ["patrimony-consolidation"] });
      toast.success("Passivo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { liabilities, isLoading, createLiability, updateLiability, deleteLiability };
}
