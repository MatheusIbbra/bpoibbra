import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface TransactionsDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "income" | "expense";
  title: string;
  totalValue: number;
}

export function TransactionsDetailModal({
  open,
  onOpenChange,
  type,
  title,
  totalValue,
}: TransactionsDetailModalProps) {
  const { data: transactions, isLoading } = useTransactions({
    type,
  });

  // Filter to only show current month transactions with category
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const filteredTransactions = transactions?.filter(t => {
    const transactionDate = parseLocalDate(t.date);
    return (
      transactionDate.getMonth() === currentMonth &&
      transactionDate.getFullYear() === currentYear &&
      t.category_id !== null
    );
  }) || [];

  const isIncome = type === "income";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isIncome ? (
              <TrendingUp className="h-5 w-5 text-success" />
            ) : (
              <TrendingDown className="h-5 w-5 text-destructive" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total do Mês</span>
            <span className={cn(
              "text-lg font-bold",
              isIncome ? "text-success" : "text-destructive"
            )}>
              {isIncome ? "+" : "-"}{formatCurrency(totalValue)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {filteredTransactions.length} transações classificadas
          </p>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma transação encontrada para este mês.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {transaction.description}
                      </p>
                      {transaction.status === "pending" && (
                        <Badge variant="outline" className="text-[10px] h-4">
                          Pendente
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{transaction.categories?.name || "—"}</span>
                      <span>•</span>
                      <span>{transaction.accounts?.name || "—"}</span>
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <p className={cn(
                      "text-sm font-semibold",
                      isIncome ? "text-success" : "text-destructive"
                    )}>
                      {isIncome ? "+" : "-"}{formatCurrency(Number(transaction.amount))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseLocalDate(transaction.date), "dd/MM/yy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
