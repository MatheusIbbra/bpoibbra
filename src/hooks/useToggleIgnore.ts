import { useMutation, useQueryClient, QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Centralised list: every financial query that must refresh when a transaction is ignored/unignored */
function invalidateAllFinancialQueries(queryClient: QueryClient) {
  const keys = [
    "transactions", "paginated-transactions",
    "dashboard-stats", "accounts",
    "pending-transactions-count",
    "monthly-plan", "budget-analysis",
    "discipline-score", "financial-events",
    "monthly-evolution", "cashflow-report",
    "dre-report", "category-analysis",
    "financial-type-report", "cash-flow",
    "consolidated-balance", "budget-alerts",
    "recurring-expenses", "reconciliation-metrics",
    "anomaly-detection", "financial-health",
    "patrimony-evolution", "structured-liquidity",
    "credit-card-summary", "credit-card-advanced",
    "reports-data",
  ];
  keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
}

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
      invalidateAllFinancialQueries(queryClient);
      toast.success(is_ignored ? "Movimentação ignorada" : "Movimentação reativada");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}
