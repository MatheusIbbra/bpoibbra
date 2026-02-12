import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Auto-detect and ignore internal transfers:
 * Same amount, same date (or ±1 day), different accounts, same org.
 * One is income, the other is expense.
 */
export function useAutoIgnoreTransfers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      // Get all non-ignored completed transactions
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("id, amount, date, account_id, type, description, is_ignored")
        .eq("organization_id", organizationId)
        .eq("status", "completed")
        .neq("is_ignored", true)
        .in("type", ["income", "expense"])
        .order("date", { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!transactions || transactions.length === 0) return { ignored: 0 };

      const toIgnore: string[] = [];
      const processed = new Set<string>();

      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        if (processed.has(tx.id)) continue;

        for (let j = i + 1; j < transactions.length; j++) {
          const other = transactions[j];
          if (processed.has(other.id)) continue;

          // Same amount, different accounts, opposite types
          if (
            Math.abs(Number(tx.amount) - Number(other.amount)) < 0.01 &&
            tx.account_id !== other.account_id &&
            ((tx.type === "income" && other.type === "expense") ||
              (tx.type === "expense" && other.type === "income"))
          ) {
            // Same date or ±1 day
            const d1 = new Date(tx.date).getTime();
            const d2 = new Date(other.date).getTime();
            const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);

            if (diffDays <= 1) {
              toIgnore.push(tx.id, other.id);
              processed.add(tx.id);
              processed.add(other.id);
              break;
            }
          }
        }
      }

      if (toIgnore.length === 0) return { ignored: 0 };

      // Batch update
      for (let i = 0; i < toIgnore.length; i += 50) {
        const chunk = toIgnore.slice(i, i + 50);
        const { error: updateError } = await supabase
          .from("transactions")
          .update({ is_ignored: true })
          .in("id", chunk);
        if (updateError) throw updateError;
      }

      return { ignored: toIgnore.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["pending-transactions-count"] });
      if (data.ignored > 0) {
        toast.success(`${data.ignored} transferências internas ignoradas automaticamente`);
      } else {
        toast.info("Nenhuma transferência interna detectada");
      }
    },
    onError: (error) => {
      toast.error("Erro ao detectar transferências: " + error.message);
    },
  });
}
