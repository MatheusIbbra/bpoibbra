import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Transaction } from "@/hooks/useTransactions";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TransactionsListDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  transactions: Transaction[];
  variant: "success" | "destructive";
  onEditTransaction: (tx: Transaction) => void;
}

export function TransactionsListDialog({
  open,
  onOpenChange,
  title,
  transactions,
  variant,
  onEditTransaction,
}: TransactionsListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm w-[calc(100vw-2rem)] sm:w-full max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto overscroll-contain">
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma movimentação</p>
          ) : (
            transactions.map((tx) => (
              <button
                key={tx.id}
                onClick={() => { onEditTransaction(tx); onOpenChange(false); }}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-secondary/40 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{tx.description || "Sem descrição"}</p>
                  <p className="text-[10px] text-muted-foreground">{tx.categories?.name}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className={cn(
                    "text-sm font-semibold tabular-nums",
                    variant === "success" ? "text-success" : "text-destructive"
                  )}>
                    <MaskedValue>{formatCurrency(tx.amount)}</MaskedValue>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(parseLocalDate(tx.date), "dd/MM", { locale: ptBR })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
