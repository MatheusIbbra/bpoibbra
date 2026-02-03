import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export function useSeedCategories() {
  const queryClient = useQueryClient();
  const { selectedOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("seed-categories", {
        body: { organization_id: selectedOrganizationId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-hierarchy"] });
      
      if (data.seeded) {
        toast.success(`${data.count} categorias iniciais criadas com sucesso!`);
      } else {
        toast.info("Categorias já existem para esta organização.");
      }
    },
    onError: (error) => {
      toast.error("Erro ao criar categorias: " + error.message);
    },
  });
}
