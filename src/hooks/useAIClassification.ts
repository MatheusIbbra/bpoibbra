import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { classifyTransactionWithAI } from "@/services/aiService";
import { toast } from "sonner";

export interface ClassificationResult {
  category_id: string | null;
  category_name: string | null;
  cost_center_id: string | null;
  cost_center_name: string | null;
  confidence: number;
  is_transfer: boolean;
  reasoning: string;
  source?: "rule" | "pattern" | "ai" | "none";
  auto_validated?: boolean;
}

interface ClassifyTransactionParams {
  transaction_id?: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  organization_id?: string | null;
}

export function useAIClassification() {
  return useMutation({
    mutationFn: async (params: ClassifyTransactionParams): Promise<ClassificationResult> => {
      const start = performance.now();
      const { data, error } = await supabase.functions.invoke("classify-transaction", {
        body: params,
      });

      if (error) throw error;
      
      const elapsed = Math.round(performance.now() - start);
      console.info(`[AI Classification] source=${data.source} confidence=${data.confidence} time=${elapsed}ms`);
      return data;
    },
    onSuccess: (result) => {
      if (result.source === "ai" && result.category_name) {
        const confidence = Math.round((result.confidence ?? 0) * 100);
        toast(`Classificado por IA · Confiança ${confidence}%${confidence < 75 ? " · Revisão recomendada" : ""}`, {
          description: `Categoria: ${result.category_name}`,
          duration: 8000,
          action: {
            label: "OK",
            onClick: () => {},
          },
        });
      }
    },
    onError: (error) => {
      console.error("AI Classification error:", error);
      toast.error("Erro ao classificar transação automaticamente");
    },
  });
}

export function useBulkAIClassification() {
  return useMutation({
    mutationFn: async (transactions: ClassifyTransactionParams[]): Promise<ClassificationResult[]> => {
      const BATCH_SIZE = 10;
      const results: ClassificationResult[] = [];

      for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
        const batch = transactions.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (tx) => {
            try {
              const { data, error } = await supabase.functions.invoke("classify-transaction", { body: tx });
              if (error) throw error;
              return data as ClassificationResult;
            } catch (e) {
              console.error("Error classifying transaction:", e);
              return {
                category_id: null,
                category_name: null,
                cost_center_id: null,
                cost_center_name: null,
                confidence: 0,
                is_transfer: false,
                reasoning: "Erro ao classificar",
              } as ClassificationResult;
            }
          })
        );
        results.push(...batchResults);
      }

      return results;
    },
    onSuccess: (results) => {
      const classified = results.filter((r) => r.category_id).length;
      toast.success(`${classified} de ${results.length} transações classificadas`);
    },
    onError: (error) => {
      console.error("Bulk AI Classification error:", error);
      toast.error("Erro ao classificar transações em lote");
    },
  });
}
