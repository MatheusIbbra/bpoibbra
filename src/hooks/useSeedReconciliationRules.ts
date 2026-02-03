import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export function useSeedReconciliationRules() {
  const queryClient = useQueryClient();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async () => {
      const organizationId = getRequiredOrganizationId();
      
      if (!organizationId) {
        throw new Error("Selecione uma base antes de criar regras de conciliação");
      }

      const { data, error } = await supabase.functions.invoke("seed-reconciliation-rules", {
        body: { organization_id: organizationId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-rules"] });
      
      if (data.seeded) {
        toast.success(`${data.created} regras de conciliação criadas com sucesso!`);
        if (data.skipped > 0) {
          toast.info(`${data.skipped} regras não puderam ser criadas (categorias não encontradas)`);
        }
      } else {
        toast.info("Regras de conciliação já existem para esta base");
      }
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar regras: ${error.message}`);
    },
  });
}
