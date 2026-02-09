import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
      const { data, error } = await supabase.functions.invoke("classify-transaction", {
        body: params,
      });

      if (error) throw error;
      return data;
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
      const results: ClassificationResult[] = [];

      for (const tx of transactions) {
        try {
          const { data, error } = await supabase.functions.invoke("classify-transaction", {
            body: tx,
          });

          if (error) {
            console.error("Error classifying transaction:", error);
            results.push({
              category_id: null,
              category_name: null,
              cost_center_id: null,
              cost_center_name: null,
              confidence: 0,
              is_transfer: false,
              reasoning: "Erro ao classificar",
            });
          } else {
            results.push(data);
          }
        } catch (e) {
          console.error("Error in bulk classification:", e);
          results.push({
            category_id: null,
            category_name: null,
            cost_center_id: null,
            cost_center_name: null,
            confidence: 0,
            is_transfer: false,
            reasoning: "Erro ao classificar",
          });
        }
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
