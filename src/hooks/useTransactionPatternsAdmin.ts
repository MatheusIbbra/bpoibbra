import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TransactionPatternWithDetails {
  id: string;
  organization_id: string;
  normalized_description: string;
  category_id: string | null;
  cost_center_id: string | null;
  transaction_type: string;
  avg_amount: number | null;
  confidence: number | null;
  occurrences: number | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  category_name: string | null;
  category_type: string | null;
  cost_center_name: string | null;
  organization_name: string | null;
}

/**
 * Hook para buscar todos os padrões de transação (admin only)
 */
export function useAllTransactionPatterns() {
  return useQuery({
    queryKey: ["admin-transaction-patterns"],
    queryFn: async (): Promise<TransactionPatternWithDetails[]> => {
      // Fetch patterns
      const { data: patterns, error: patternsError } = await supabase
        .from("transaction_patterns")
        .select("*")
        .order("created_at", { ascending: false });

      if (patternsError) {
        console.error("Error fetching patterns:", patternsError);
        throw patternsError;
      }

      if (!patterns || patterns.length === 0) {
        return [];
      }

      // Fetch related data
      const categoryIds = [...new Set(patterns.map(p => p.category_id).filter(Boolean))];
      const costCenterIds = [...new Set(patterns.map(p => p.cost_center_id).filter(Boolean))];
      const organizationIds = [...new Set(patterns.map(p => p.organization_id))];

      const [categoriesRes, costCentersRes, organizationsRes] = await Promise.all([
        categoryIds.length > 0 
          ? supabase.from("categories").select("id, name, type").in("id", categoryIds)
          : { data: [], error: null },
        costCenterIds.length > 0
          ? supabase.from("cost_centers").select("id, name").in("id", costCenterIds)
          : { data: [], error: null },
        supabase.from("organizations").select("id, name").in("id", organizationIds),
      ]);

      const categoriesMap = new Map(
        (categoriesRes.data || []).map(c => [c.id, { name: c.name, type: c.type }])
      );
      const costCentersMap = new Map(
        (costCentersRes.data || []).map(c => [c.id, c.name])
      );
      const organizationsMap = new Map(
        (organizationsRes.data || []).map(o => [o.id, o.name])
      );

      return patterns.map(pattern => ({
        ...pattern,
        category_name: pattern.category_id ? categoriesMap.get(pattern.category_id)?.name || null : null,
        category_type: pattern.category_id ? categoriesMap.get(pattern.category_id)?.type || null : null,
        cost_center_name: pattern.cost_center_id ? costCentersMap.get(pattern.cost_center_id) || null : null,
        organization_name: organizationsMap.get(pattern.organization_id) || null,
      }));
    },
  });
}

/**
 * Hook para deletar um padrão de transação
 */
export function useDeleteTransactionPattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patternId: string) => {
      const { error } = await supabase
        .from("transaction_patterns")
        .delete()
        .eq("id", patternId);

      if (error) throw error;
      return patternId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-transaction-patterns"] });
      toast.success("Padrão excluído com sucesso");
    },
    onError: (error) => {
      console.error("Error deleting pattern:", error);
      toast.error("Erro ao excluir padrão");
    },
  });
}
