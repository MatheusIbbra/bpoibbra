import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Auto-detect and ignore internal transfers:
 * Same amount, same date (or ±1 day), different accounts, same org.
 * One is income, the other is expense.
 * 
 * Also detects investment/redemption pairs:
 * - expense in a regular account + investment transaction in an investment account → Aporte
 * - income in a regular account + redemption in an investment account → Resgate
 */
export function useAutoIgnoreTransfers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      // Get ALL non-ignored completed transactions (paginated to bypass 1000 limit)
      let allTransactions: any[] = [];
      let page = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data: batch, error } = await supabase
          .from("transactions")
          .select("id, amount, date, account_id, type, description, is_ignored")
          .eq("organization_id", organizationId)
          .eq("status", "completed")
          .neq("is_ignored", true)
          .in("type", ["income", "expense", "investment", "redemption"])
          .order("date", { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error) throw error;
        if (!batch || batch.length === 0) break;
        allTransactions = allTransactions.concat(batch);
        if (batch.length < pageSize) break;
        page++;
      }

      if (allTransactions.length === 0) return { ignored: 0 };

      // Fetch investment accounts for the organization
      const { data: ofAccounts } = await supabase
        .from("open_finance_accounts")
        .select("local_account_id, account_type")
        .eq("organization_id", organizationId);
      const investmentAccountIds = new Set(
        (ofAccounts || [])
          .filter(a => ["INVESTMENT", "investment"].includes(a.account_type || ""))
          .map(a => a.local_account_id)
          .filter(Boolean)
      );

      const toIgnore: string[] = [];
      const toMarkInvestment: string[] = []; // expense → investment
      const toMarkRedemption: string[] = []; // income → redemption
      const processed = new Set<string>();

      for (let i = 0; i < allTransactions.length; i++) {
        const tx = allTransactions[i];
        if (processed.has(tx.id)) continue;

        for (let j = i + 1; j < allTransactions.length; j++) {
          const other = allTransactions[j];
          if (processed.has(other.id)) continue;

          // Same amount, different accounts
          if (
            Math.abs(Number(tx.amount) - Number(other.amount)) < 0.01 &&
            tx.account_id !== other.account_id
          ) {
            // Same date or ±1 day
            const d1 = new Date(tx.date).getTime();
            const d2 = new Date(other.date).getTime();
            const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);

            if (diffDays <= 1) {
              const txIsInvestment = investmentAccountIds.has(tx.account_id);
              const otherIsInvestment = investmentAccountIds.has(other.account_id);

              // Case 1: Pure income/expense pair → internal transfer, ignore both
              if (
                (tx.type === "income" && other.type === "expense") ||
                (tx.type === "expense" && other.type === "income")
              ) {
                // If one is in an investment account, reclassify instead of ignoring
                if (txIsInvestment || otherIsInvestment) {
                  const expenseTx = tx.type === "expense" ? tx : other;
                  const incomeTx = tx.type === "income" ? tx : other;
                  // expense in regular → investment account credit = Aporte
                  if (!investmentAccountIds.has(expenseTx.account_id) && investmentAccountIds.has(incomeTx.account_id)) {
                    toMarkInvestment.push(expenseTx.id); // reclassify as investment
                    toIgnore.push(incomeTx.id); // the matching credit side gets ignored
                  } else if (investmentAccountIds.has(expenseTx.account_id) && !investmentAccountIds.has(incomeTx.account_id)) {
                    // income in regular ← investment account debit = Resgate
                    toMarkRedemption.push(incomeTx.id); // reclassify as redemption
                    toIgnore.push(expenseTx.id); // the matching debit side gets ignored
                  } else {
                    // Both investment accounts → standard internal transfer
                    toIgnore.push(tx.id, other.id);
                  }
                } else {
                  toIgnore.push(tx.id, other.id);
                }
                processed.add(tx.id);
                processed.add(other.id);
                break;
              }
            }
          }
        }
      }

      // Batch updates
      for (let i = 0; i < toIgnore.length; i += 50) {
        const chunk = toIgnore.slice(i, i + 50);
        await supabase.from("transactions").update({ is_ignored: true }).in("id", chunk);
      }
      for (let i = 0; i < toMarkInvestment.length; i += 50) {
        const chunk = toMarkInvestment.slice(i, i + 50);
        await supabase.from("transactions").update({ type: "investment" }).in("id", chunk);
      }
      for (let i = 0; i < toMarkRedemption.length; i += 50) {
        const chunk = toMarkRedemption.slice(i, i + 50);
        await supabase.from("transactions").update({ type: "redemption" }).in("id", chunk);
      }

      return { ignored: toIgnore.length, reclassified: toMarkInvestment.length + toMarkRedemption.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["pending-transactions-count"] });
      if ((data.reclassified || 0) > 0) {
        toast.success(`${data.reclassified} movimentações reclassificadas como Aporte/Resgate`);
      } else if (data.ignored > 0) {
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
