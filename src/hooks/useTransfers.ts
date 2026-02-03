import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type TransferRow = Database["public"]["Tables"]["transfers"]["Row"];
type TransferInsert = Database["public"]["Tables"]["transfers"]["Insert"];

export interface Transfer extends Omit<TransferRow, 'amount'> {
  amount: number;
  origin_account?: {
    id: string;
    name: string;
    bank_name: string;
  };
  destination_account?: {
    id: string;
    name: string;
    bank_name: string;
  };
}

export function useTransfers() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["transfers", user?.id, orgFilter.type, orgFilter.ids],
    queryFn: async () => {
      let query = supabase
        .from("transfers")
        .select(`
          *,
          origin_account:accounts!origin_account_id(id, name, bank_name),
          destination_account:accounts!destination_account_id(id, name, bank_name)
        `)
        .order("transfer_date", { ascending: false });

      // Aplicar filtro de organização
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).map(t => ({
        ...t,
        amount: Number(t.amount),
        origin_account: Array.isArray(t.origin_account) ? t.origin_account[0] : t.origin_account,
        destination_account: Array.isArray(t.destination_account) ? t.destination_account[0] : t.destination_account,
      })) as Transfer[];
    },
    enabled: !!user,
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { getRequiredOrganizationId } = useBaseFilter();

  return useMutation({
    mutationFn: async (transfer: {
      origin_account_id: string;
      destination_account_id: string;
      amount: number;
      transfer_date: string;
      description?: string;
    }) => {
      const organizationId = getRequiredOrganizationId();
      
      if (!organizationId) {
        throw new Error("Selecione uma base antes de realizar uma transferência");
      }
      
      if (transfer.origin_account_id === transfer.destination_account_id) {
        throw new Error("Conta de origem e destino devem ser diferentes");
      }

      const insertData: TransferInsert = {
        ...transfer,
        user_id: user!.id,
        organization_id: organizationId,
      };

      const { data, error } = await supabase
        .from("transfers")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Transferência realizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao realizar transferência: " + error.message);
    },
  });
}

export function useDeleteTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transfers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Transferência excluída!");
    },
    onError: (error) => {
      toast.error("Erro ao excluir transferência: " + error.message);
    },
  });
}
