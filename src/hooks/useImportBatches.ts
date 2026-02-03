import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { toast } from "sonner";

export interface ImportBatch {
  id: string;
  organization_id: string;
  account_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  total_transactions: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  accounts?: {
    name: string;
    bank_name: string | null;
  };
  organizations?: {
    name: string;
  };
}

export function useImportBatches() {
  const { user } = useAuth();
  const { getOrganizationFilter } = useBaseFilter();
  const orgFilter = getOrganizationFilter();

  return useQuery({
    queryKey: ["import-batches", orgFilter.ids],
    queryFn: async () => {
      let query = supabase
        .from("import_batches")
        .select(`
          *,
          accounts(name, bank_name),
          organizations(name)
        `)
        .order("created_at", { ascending: false });

      // Apply organization filter
      if (orgFilter.type === 'single') {
        query = query.eq("organization_id", orgFilter.ids[0]);
      } else if (orgFilter.type === 'multiple' && orgFilter.ids.length > 0) {
        query = query.in("organization_id", orgFilter.ids);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ImportBatch[];
    },
    enabled: !!user && orgFilter.ids.length > 0,
  });
}

export function useCreateImportBatch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      organizationId: string;
      accountId: string;
      fileName: string;
      filePath: string;
      fileType: string;
      fileSize?: number;
    }) => {
      const { data: batch, error } = await supabase
        .from("import_batches")
        .insert({
          organization_id: data.organizationId,
          account_id: data.accountId,
          user_id: user!.id,
          file_name: data.fileName,
          file_path: data.filePath,
          file_type: data.fileType,
          file_size: data.fileSize,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return batch as ImportBatch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
    },
    onError: (error) => {
      toast.error("Erro ao criar lote de importação: " + error.message);
    },
  });
}

export function useProcessImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      batchId: string;
      organizationId: string;
      accountId: string;
      fileContent?: string;
      filePath?: string;
      fileType: "ofx" | "csv" | "pdf";
    }) => {
      const { data: result, error } = await supabase.functions.invoke(
        "process-import",
        {
          body: data,
        }
      );

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      
      toast.success(
        `Importação concluída: ${result.imported} transações importadas, ${result.duplicates} duplicatas ignoradas`
      );
    },
    onError: (error) => {
      toast.error("Erro ao processar importação: " + error.message);
    },
  });
}

export function useClassifyTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      transactionIds: string[];
      organizationId: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke(
        "classify-transactions",
        {
          body: data,
        }
      );

      if (error) throw error;
      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["ai-suggestions"] });
      
      toast.success(`${result.suggestionsCreated} sugestões de classificação criadas`);
    },
    onError: (error) => {
      toast.error("Erro ao classificar transações: " + error.message);
    },
  });
}

export function useAISuggestions(transactionId: string | undefined) {
  return useQuery({
    queryKey: ["ai-suggestions", transactionId],
    queryFn: async () => {
      if (!transactionId) return null;

      const { data, error } = await supabase
        .from("ai_suggestions")
        .select(`
          *,
          categories(name, color, icon),
          cost_centers(name)
        `)
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!transactionId,
  });
}

export function useAcceptSuggestion() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      suggestionId: string;
      transactionId: string;
      categoryId: string | null;
      costCenterId: string | null;
      competenceDate: string | null;
    }) => {
      // Update transaction with accepted values
      const { error: txError } = await supabase
        .from("transactions")
        .update({
          category_id: data.categoryId,
          cost_center_id: data.costCenterId,
          accrual_date: data.competenceDate,
          validation_status: "validated",
          validated_by: user!.id,
          validated_at: new Date().toISOString(),
        })
        .eq("id", data.transactionId);

      if (txError) throw txError;

      // Mark suggestion as accepted
      const { error: sugError } = await supabase
        .from("ai_suggestions")
        .update({
          was_accepted: true,
          accepted_at: new Date().toISOString(),
          accepted_by: user!.id,
        })
        .eq("id", data.suggestionId);

      if (sugError) throw sugError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["ai-suggestions"] });
      toast.success("Sugestão aceita e transação validada!");
    },
    onError: (error) => {
      toast.error("Erro ao aceitar sugestão: " + error.message);
    },
  });
}

export function useRejectSuggestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (suggestionId: string) => {
      const { error } = await supabase
        .from("ai_suggestions")
        .update({ was_accepted: false })
        .eq("id", suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-suggestions"] });
      toast.info("Sugestão rejeitada");
    },
    onError: (error) => {
      toast.error("Erro ao rejeitar sugestão: " + error.message);
    },
  });
}

export function useDeleteImportBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      // Delete will cascade to transactions due to FK
      const { error } = await supabase
        .from("import_batches")
        .delete()
        .eq("id", batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-batches"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Lote de importação excluído com todas as transações");
    },
    onError: (error) => {
      toast.error("Erro ao excluir lote: " + error.message);
    },
  });
}
