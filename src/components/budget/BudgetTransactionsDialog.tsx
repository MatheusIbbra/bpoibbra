import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, TrendingDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { BudgetAnalysisItem } from "@/hooks/useBudgetAnalysis";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import type { Transaction } from "@/hooks/useTransactions";

interface BudgetTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BudgetAnalysisItem;
  month: number;
  year: number;
}

export function BudgetTransactionsDialog({
  open,
  onOpenChange,
  item,
  month,
  year,
}: BudgetTransactionsDialogProps) {
  const { data: allTransactions, isLoading } = useTransactions({ type: "expense" });
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const filtered = allTransactions?.filter((t) => {
    const d = parseLocalDate(t.date);
    return (
      t.category_id === item.category_id &&
      d >= startDate &&
      d <= endDate
    );
  }) || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[550px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: item.category_color }}
              />
              {item.category_name}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Planejado</p>
              <p className="text-sm font-bold">{formatCurrency(item.budget_amount)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">Realizado</p>
              <p className={cn("text-sm font-bold", item.status === "over" && "text-destructive")}>
                {formatCurrency(item.actual_amount)}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-2">
            {filtered.length} movimentação{filtered.length !== 1 ? "ões" : ""}
          </p>

          <ScrollArea className="h-[350px] pr-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">
                Nenhuma movimentação encontrada.
              </p>
            ) : (
              <div className="space-y-1.5">
                {filtered.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => {
                      setEditTx(tx);
                      setEditOpen(true);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{tx.accounts?.name || "—"}</span>
                        {tx.status === "pending" && (
                          <Badge variant="outline" className="text-[10px] h-4">Pendente</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-destructive">
                        -{formatCurrency(Number(tx.amount))}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseLocalDate(tx.date), "dd/MM/yy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <TransactionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        transaction={editTx}
      />
    </>
  );
}
