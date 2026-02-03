import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBaseFilter } from "@/contexts/BaseFilterContext";

export interface ReconciliationMetrics {
  // Transaction counts
  totalTransactions: number;
  autoValidated: number;
  manuallyValidated: number;
  pending: number;
  
  // Auto-validation sources
  autoByRule: number;
  autoByPattern: number;
  autoByAI: number;
  
  // Percentages
  autoValidationRate: number;
  ruleMatchRate: number;
  patternMatchRate: number;
  
  // Patterns
  totalPatterns: number;
  highConfidencePatterns: number;
  
  // Estimated time savings (minutes)
  estimatedTimeSaved: number;
}

/**
 * Hook para buscar métricas de performance do motor de conciliação
 * Retorna estatísticas sobre auto-validação, economia de tempo, etc.
 */
export function useReconciliationMetrics() {
  const { viewableOrganizationIds } = useBaseFilter();

  return useQuery({
    queryKey: ["reconciliation-metrics", viewableOrganizationIds],
    queryFn: async (): Promise<ReconciliationMetrics> => {
      // Build base filter for transactions
      let transactionsQuery = supabase
        .from("transactions")
        .select("id, validation_status, classification_source, validated_at", { count: "exact" });

      if (viewableOrganizationIds && viewableOrganizationIds.length > 0) {
        transactionsQuery = transactionsQuery.in("organization_id", viewableOrganizationIds);
      }

      const { data: transactions, count: totalCount, error: transError } = await transactionsQuery;

      if (transError) {
        console.error("Error fetching transactions for metrics:", transError);
        throw transError;
      }

      // Fetch patterns count
      let patternsQuery = supabase
        .from("transaction_patterns")
        .select("id, confidence", { count: "exact" });

      if (viewableOrganizationIds && viewableOrganizationIds.length > 0) {
        patternsQuery = patternsQuery.in("organization_id", viewableOrganizationIds);
      }

      const { data: patterns, count: patternsCount, error: patternError } = await patternsQuery;

      if (patternError) {
        console.error("Error fetching patterns for metrics:", patternError);
      }

      const transactionsList = transactions || [];
      const totalTransactions = totalCount || 0;

      // Count by validation status
      const autoValidated = transactionsList.filter(t => 
        t.validation_status === "validated" && 
        t.classification_source && 
        t.classification_source !== "manual"
      ).length;

      const manuallyValidated = transactionsList.filter(t => 
        t.validation_status === "validated" && 
        (!t.classification_source || t.classification_source === "manual")
      ).length;

      const pending = transactionsList.filter(t => 
        t.validation_status === "pending_validation" || 
        t.validation_status === "needs_review"
      ).length;

      // Count by classification source
      const autoByRule = transactionsList.filter(t => 
        t.classification_source === "rule"
      ).length;

      const autoByPattern = transactionsList.filter(t => 
        t.classification_source === "pattern"
      ).length;

      const autoByAI = transactionsList.filter(t => 
        t.classification_source === "ai"
      ).length;

      // Calculate rates
      const validatedTotal = autoValidated + manuallyValidated;
      const autoValidationRate = validatedTotal > 0 
        ? (autoValidated / validatedTotal) * 100 
        : 0;

      const ruleMatchRate = totalTransactions > 0 
        ? (autoByRule / totalTransactions) * 100 
        : 0;

      const patternMatchRate = totalTransactions > 0 
        ? (autoByPattern / totalTransactions) * 100 
        : 0;

      // Patterns metrics
      const totalPatterns = patternsCount || 0;
      const highConfidencePatterns = patterns?.filter(p => 
        (p.confidence || 0) >= 0.85
      ).length || 0;

      // Estimated time saved (2 minutes per auto-validated transaction)
      const MINUTES_PER_TRANSACTION = 2;
      const estimatedTimeSaved = autoValidated * MINUTES_PER_TRANSACTION;

      return {
        totalTransactions,
        autoValidated,
        manuallyValidated,
        pending,
        autoByRule,
        autoByPattern,
        autoByAI,
        autoValidationRate,
        ruleMatchRate,
        patternMatchRate,
        totalPatterns,
        highConfidencePatterns,
        estimatedTimeSaved,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
