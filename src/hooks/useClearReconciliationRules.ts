import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export function useClearReconciliationRules() {
  const queryClient = useQueryClient();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async () => {
      const organizationId = getRequiredOrganizationId();
      if (!organizationId) {
        throw new Error("Selecione uma base específica antes de limpar as regras");
      }

      const { error } = await supabase
        .from("reconciliation_rules")
        .delete()
        .eq("organization_id", organizationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reconciliation-rules"] });
      toast.success("Todas as regras de conciliação foram excluídas!");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao limpar regras: ${error.message}`);
    },
  });
}
