import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export function useDataExport() {
  const { user } = useAuth();
  const { selectedOrganizationId } = useBaseFilter();
  const queryClient = useQueryClient();

  const requestsQuery = useQuery({
    queryKey: ["data-export-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_export_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const requestExport = useMutation({
    mutationFn: async (exportType: "full" | "transactions" | "profile") => {
      const { error } = await supabase.from("data_export_requests").insert({
        user_id: user!.id,
        organization_id: selectedOrganizationId !== "all" ? selectedOrganizationId : null,
        export_type: exportType,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-export-requests"] });
      toast.success("Solicitação de exportação registrada. Você será notificado quando estiver pronta.");
    },
    onError: (error) => {
      toast.error("Erro ao solicitar exportação: " + error.message);
    },
  });

  return {
    requests: requestsQuery.data || [],
    isLoading: requestsQuery.isLoading,
    requestExport,
  };
}
