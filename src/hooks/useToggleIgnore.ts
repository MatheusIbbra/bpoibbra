import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useToggleIgnoreTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_ignored }: { id: string; is_ignored: boolean }) => {
      const { error } = await supabase
        .from("transactions")
        .update({ is_ignored })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { is_ignored }) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast.success(is_ignored ? "Movimentação ignorada" : "Movimentação reativada");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}
