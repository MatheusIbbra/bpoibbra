import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Normaliza uma descrição de transação para matching
 */
function normalizeDescription(text: string): string {
  let result = text.toLowerCase();
  
  // Remove acentos
  result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Remove números curtos (1-4 dígitos)
  result = result.replace(/\b\d{1,4}\b/g, "");
  
  // Remove stopwords bancárias
  const bankStopwords = /\b(pix|ted|doc|tev|transf|deb|cred|pag|rec|ref|nr|num|nf|cp|dp|de|para|em|do|da|dos|das|o|a|os|as|e|ou|que|com|por|no|na|nos|nas|um|uma|uns|umas)\b/gi;
  result = result.replace(bankStopwords, "");
  
  // Remove caracteres especiais
  result = result.replace(/[^a-z0-9\s]/g, "");
  
  // Normaliza espaços
  result = result.replace(/\s+/g, " ");
  
  return result.trim();
}

interface LearnFromValidationParams {
  organizationId: string;
  description: string;
  categoryId: string | null;
  costCenterId: string | null;
  transactionType: string;
  amount: number;
}

/**
 * Hook para gerenciar o aprendizado de padrões de transações
 */
export function useLearnFromValidation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: LearnFromValidationParams) => {
      const { organizationId, description, categoryId, costCenterId, transactionType, amount } = params;
      
      if (!categoryId || !description) {
        return null; // Não aprender se não tiver categoria ou descrição
      }

      const normalizedDescription = normalizeDescription(description);
      
      if (normalizedDescription.length < 3) {
        return null; // Descrição muito curta para aprender
      }

      // Tentar usar a função SQL se disponível, senão fazer manualmente
      try {
        // Primeiro, verificar se já existe um pattern similar
        const { data: existingPatterns, error: fetchError } = await supabase
          .from("transaction_patterns")
          .select("id, occurrences, avg_amount, confidence, cost_center_id")
          .eq("organization_id", organizationId)
          .eq("normalized_description", normalizedDescription)
          .eq("category_id", categoryId)
          .eq("transaction_type", transactionType)
          .limit(1);

        if (fetchError) {
          console.error("Error fetching patterns:", fetchError);
          throw fetchError;
        }

        if (existingPatterns && existingPatterns.length > 0) {
          // Atualizar pattern existente
          const existing = existingPatterns[0];
          const newOccurrences = (existing.occurrences || 1) + 1;
          const newAvgAmount = ((existing.avg_amount || 0) * (existing.occurrences || 1) + amount) / newOccurrences;
          const newConfidence = Math.min(0.99, 0.5 + (newOccurrences * 0.05));

          const { error: updateError } = await supabase
            .from("transaction_patterns")
            .update({
              occurrences: newOccurrences,
              avg_amount: newAvgAmount,
              confidence: newConfidence,
              cost_center_id: costCenterId || existing.cost_center_id,
              last_used_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateError) throw updateError;

          console.log(`[LEARN] Atualizado pattern existente: ${existing.id} (${newOccurrences} ocorrências, ${(newConfidence*100).toFixed(0)}% confiança)`);
          return existing.id;
        } else {
          // Criar novo pattern
          const { data: newPattern, error: insertError } = await supabase
            .from("transaction_patterns")
            .insert({
              organization_id: organizationId,
              normalized_description: normalizedDescription,
              category_id: categoryId,
              cost_center_id: costCenterId,
              transaction_type: transactionType,
              avg_amount: amount,
              confidence: 0.6,
              occurrences: 1,
            })
            .select("id")
            .single();

          if (insertError) {
            // Ignorar erro de duplicata (pode acontecer em race conditions)
            if (insertError.code === "23505") {
              console.log("[LEARN] Pattern já existe (race condition), ignorando...");
              return null;
            }
            throw insertError;
          }

          console.log(`[LEARN] Criado novo pattern: ${newPattern?.id}`);
          return newPattern?.id;
        }
      } catch (error) {
        console.error("[LEARN] Error learning from validation:", error);
        // Não propagar erro - aprendizado é opcional
        return null;
      }
    },
    onSuccess: (patternId) => {
      if (patternId) {
        queryClient.invalidateQueries({ queryKey: ["transaction-patterns"] });
      }
    },
    onError: (error) => {
      console.error("Learn from validation error:", error);
      // Silencioso - não mostrar toast para erro de aprendizado
    },
  });
}

/**
 * Hook para normalizar uma descrição (útil para debug)
 */
export function useNormalizeDescription() {
  return {
    normalize: normalizeDescription,
  };
}
