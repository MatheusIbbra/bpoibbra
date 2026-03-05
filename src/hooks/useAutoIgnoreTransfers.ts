import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Auto-detect and classify internal transfers.
 *
 * Detection criteria (same-org pair):
 *   • same amount (±0.01)
 *   • date difference ≤ 1 day
 *   • one DEBIT (expense/investment) + one CREDIT (income/redemption)
 *   • different accounts
 *
 * Classification rules:
 *   1. APORTE: expense in regular acct + income in investment acct
 *      → primary (regular): type=investment (debit), is_ignored=false
 *      → secondary (investment): type=redemption (credit), is_ignored=true, validation_status=rejected
 *
 *   2. RESGATE: expense in investment acct + income in regular acct
 *      → primary (regular): type=redemption (credit), is_ignored=false
 *      → secondary (investment): type=investment (debit), is_ignored=true, validation_status=rejected
 *
 *   3. INTERNAL TRANSFER: both regular accts (or both investment accts)
 *      → primary: type=transfer, is_ignored=false
 *      → secondary: type=transfer, is_ignored=true, validation_status=rejected
 *
 * The financial_events trigger then correctly maps:
 *   investment → investment_contribution (impact_investments=true, impact_cashflow=false)
 *   redemption → investment_withdraw     (impact_investments=true, impact_cashflow=false)
 *   transfer   → internal_transfer       (impact_investments=false, impact_cashflow=false)
 */
export function useAutoIgnoreTransfers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (organizationId: string) => {
      // Paginated fetch of all relevant transactions
      let allTransactions: any[] = [];
      let page = 0;
      const pageSize = 1000;

      while (true) {
        const { data: batch, error } = await supabase
          .from("transactions")
          .select("id, amount, date, account_id, type, description, is_ignored, validation_status, linked_transaction_id")
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

      if (allTransactions.length === 0) return { ignored: 0, reclassified: 0 };

      // Fetch investment accounts
      const { data: ofAccounts } = await supabase
        .from("open_finance_accounts")
        .select("local_account_id, account_type")
        .eq("organization_id", organizationId);

      const { data: localAccounts } = await supabase
        .from("accounts")
        .select("id, account_type")
        .eq("organization_id", organizationId)
        .eq("status", "active");

      const investmentAccountIds = new Set<string>();
      // From Open Finance
      (ofAccounts || [])
        .filter(a => ["INVESTMENT", "investment"].includes(a.account_type || ""))
        .forEach(a => { if (a.local_account_id) investmentAccountIds.add(a.local_account_id); });
      // From local accounts
      (localAccounts || [])
        .filter(a => a.account_type === "investment")
        .forEach(a => investmentAccountIds.add(a.id));

      // Results buckets
      const toMarkTransfer: string[] = [];        // type=transfer, is_ignored=false
      const toMarkTransferIgnored: string[] = []; // type=transfer, is_ignored=true, rejected
      const toMarkInvestment: string[] = [];      // type=investment, is_ignored=false (aporte primary)
      const toMarkRedemptionIgnored: string[] = [];// type=redemption, is_ignored=true, rejected (aporte secondary)
      const toMarkRedemption: string[] = [];      // type=redemption, is_ignored=false (resgate primary)
      const toMarkInvestmentIgnored: string[] = [];// type=investment, is_ignored=true, rejected (resgate secondary)

      const processed = new Set<string>();

      for (let i = 0; i < allTransactions.length; i++) {
        const tx = allTransactions[i];
        if (processed.has(tx.id)) continue;

        for (let j = i + 1; j < allTransactions.length; j++) {
          const other = allTransactions[j];
          if (processed.has(other.id)) continue;
          if (tx.account_id === other.account_id) continue;

          // Same amount
          if (Math.abs(Number(tx.amount) - Number(other.amount)) >= 0.01) continue;

          // Date within 1 day
          const d1 = new Date(tx.date).getTime();
          const d2 = new Date(other.date).getTime();
          if (Math.abs(d1 - d2) / (1000 * 60 * 60 * 24) > 1) continue;

          // Must be debit/credit pair
          const isDebit = (t: any) => t.type === "expense" || t.type === "investment";
          const isCredit = (t: any) => t.type === "income" || t.type === "redemption";

          let debitTx: any, creditTx: any;
          if (isDebit(tx) && isCredit(other)) { debitTx = tx; creditTx = other; }
          else if (isCredit(tx) && isDebit(other)) { debitTx = other; creditTx = tx; }
          else continue;

          const debitIsInv  = investmentAccountIds.has(debitTx.account_id);
          const creditIsInv = investmentAccountIds.has(creditTx.account_id);

          if (!debitIsInv && creditIsInv) {
            // APORTE: regular → investment
            toMarkInvestment.push(debitTx.id);
            toMarkRedemptionIgnored.push(creditTx.id);
          } else if (debitIsInv && !creditIsInv) {
            // RESGATE: investment → regular
            toMarkRedemption.push(creditTx.id);
            toMarkInvestmentIgnored.push(debitTx.id);
          } else {
            // Internal transfer between regular accts (or both investment)
            toMarkTransfer.push(debitTx.id);
            toMarkTransferIgnored.push(creditTx.id);
          }

          processed.add(tx.id);
          processed.add(other.id);
          break;
        }
      }

      const batchUpdate = async (ids: string[], updates: Record<string, unknown>) => {
        for (let i = 0; i < ids.length; i += 50) {
          const chunk = ids.slice(i, i + 50);
          await supabase.from("transactions").update(updates).in("id", chunk);
        }
      };

      await Promise.all([
        batchUpdate(toMarkTransfer,         { type: "transfer", is_ignored: false, validation_status: "pending_validation" }),
        batchUpdate(toMarkTransferIgnored,  { type: "transfer", is_ignored: true,  validation_status: "rejected" }),
        batchUpdate(toMarkInvestment,       { type: "investment", is_ignored: false, validation_status: "pending_validation" }),
        batchUpdate(toMarkRedemptionIgnored,{ type: "redemption", is_ignored: true,  validation_status: "rejected" }),
        batchUpdate(toMarkRedemption,       { type: "redemption", is_ignored: false, validation_status: "pending_validation" }),
        batchUpdate(toMarkInvestmentIgnored,{ type: "investment", is_ignored: true,  validation_status: "rejected" }),
      ]);

      const totalTransfers   = toMarkTransfer.length;
      const totalAportes     = toMarkInvestment.length;
      const totalResgates    = toMarkRedemption.length;

      return { ignored: totalTransfers, reclassified: totalAportes + totalResgates };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["financial-events"] });
      queryClient.invalidateQueries({ queryKey: ["pending-transactions-count"] });

      if (data.reclassified > 0 && data.ignored > 0) {
        toast.success(`${data.reclassified} aportes/resgates e ${data.ignored} transferências internas identificados`);
      } else if (data.reclassified > 0) {
        toast.success(`${data.reclassified} movimentações reclassificadas como Aporte/Resgate`);
      } else if (data.ignored > 0) {
        toast.success(`${data.ignored} transferências internas detectadas`);
      } else {
        toast.info("Nenhuma transferência interna detectada");
      }
    },
    onError: (error) => {
      toast.error("Erro ao detectar transferências: " + error.message);
    },
  });
}
