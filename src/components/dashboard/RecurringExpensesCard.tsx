import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useRecurringExpenses } from "@/hooks/useRecurringExpenses";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { RepeatIcon, CalendarDays } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function RecurringExpensesCard() {
  const { data: expenses, isLoading } = useRecurringExpenses();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <RepeatIcon className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Despesas Recorrentes</CardTitle>
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-32 w-full" /></CardContent>
      </Card>
    );
  }

  if (!expenses || expenses.length === 0) return null;

  const monthlyExpenses = expenses.filter(e => e.is_monthly);
  const totalMonthly = monthlyExpenses.reduce((sum, e) => sum + e.avg_amount, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RepeatIcon className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Despesas Recorrentes</CardTitle>
          </div>
          <Badge variant="secondary">
            <MaskedValue>{formatCurrency(totalMonthly)}</MaskedValue>/mês
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {expenses.slice(0, 10).map((expense, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 group">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate capitalize">{expense.description}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    {expense.occurrences}x detectada
                  </span>
                  {expense.is_monthly && (
                    <Badge variant="outline" className="h-4 text-[9px] px-1">Mensal</Badge>
                  )}
                  {expense.confidence >= 0.85 && (
                    <Badge variant="default" className="h-4 text-[9px] px-1">Alta confiança</Badge>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-sm font-semibold">
                  <MaskedValue>{formatCurrency(expense.avg_amount)}</MaskedValue>
                </p>
                {expense.next_due_date && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CalendarDays className="h-2.5 w-2.5" />
                    <span>
                      {(() => {
                        try {
                          return format(parseISO(expense.next_due_date), "dd/MM", { locale: ptBR });
                        } catch {
                          return "—";
                        }
                      })()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
