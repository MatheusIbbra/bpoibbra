import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface PatrimonyAsset {
  id: string;
  entity_id: string;
  organization_id: string;
  asset_type: "conta" | "investimento" | "imovel" | "participacao" | "outro";
  description: string;
  current_value: number;
  liquidity: "alta" | "media" | "baixa";
  reference_date: string;
  notes: string | null;
  created_at: string;
}

export function usePatrimonyAssets(entityId?: string) {
  const { user } = useAuth();
  const { selectedOrganizationId: selectedBaseId } = useBaseFilter();
  const queryClient = useQueryClient();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ["patrimony-assets", selectedBaseId, entityId],
    queryFn: async () => {
      if (!selectedBaseId) return [];
      let query = supabase.from("patrimony_assets").select("*").eq("organization_id", selectedBaseId);
      if (entityId) query = query.eq("entity_id", entityId);
      const { data, error } = await query.order("current_value", { ascending: false });
      if (error) throw error;
      return data as PatrimonyAsset[];
    },
    enabled: !!user && !!selectedBaseId,
  });

  const createAsset = useMutation({
    mutationFn: async (asset: Omit<PatrimonyAsset, "id" | "organization_id" | "created_at">) => {
      if (!selectedBaseId) throw new Error("Nenhuma base selecionada");
      const { data, error } = await supabase
        .from("patrimony_assets")
        .insert({ ...asset, organization_id: selectedBaseId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimony-assets"] });
      queryClient.invalidateQueries({ queryKey: ["patrimony-consolidation"] });
      toast.success("Ativo adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAsset = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PatrimonyAsset> & { id: string }) => {
      const { error } = await supabase.from("patrimony_assets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimony-assets"] });
      queryClient.invalidateQueries({ queryKey: ["patrimony-consolidation"] });
      toast.success("Ativo atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patrimony_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patrimony-assets"] });
      queryClient.invalidateQueries({ queryKey: ["patrimony-consolidation"] });
      toast.success("Ativo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { assets, isLoading, createAsset, updateAsset, deleteAsset };
}
