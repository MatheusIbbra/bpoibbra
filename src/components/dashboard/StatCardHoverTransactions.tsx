import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useTransactions } from "@/hooks/useTransactions";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface StatCardHoverTransactionsProps {
  type: "income" | "expense";
}

export function StatCardHoverTransactions({ type }: StatCardHoverTransactionsProps) {
  const { data: transactions, isLoading } = useTransactions({ type });

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const filtered = transactions
    ?.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    ?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    ?.slice(0, 8) || [];

  const isIncome = type === "income";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="p-3 text-center">
        <p className="text-xs text-muted-foreground">Sem movimentações no mês</p>
      </div>
    );
  }

  return (
    <div className="p-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
        {isIncome ? "Receitas" : "Despesas"} do mês
      </p>
      <div className="space-y-0.5">
        {filtered.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between gap-2 px-1.5 py-1 rounded hover:bg-muted/40 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{tx.description || "—"}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {tx.categories?.name || "Sem categoria"} · {format(new Date(tx.date), "dd/MM", { locale: ptBR })}
              </p>
            </div>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums shrink-0",
                isIncome ? "text-success" : "text-destructive"
              )}
            >
              {formatCurrency(Number(tx.amount))}
            </span>
          </div>
        ))}
      </div>
      {filtered.length >= 8 && (
        <p className="text-[10px] text-muted-foreground text-center mt-1.5">
          e mais movimentações...
        </p>
      )}
    </div>
  );
}
