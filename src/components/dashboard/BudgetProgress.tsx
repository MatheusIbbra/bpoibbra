import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useBudgets } from "@/hooks/useBudgets";
import { useTransactions } from "@/hooks/useTransactions";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";

export function BudgetProgress() {
  const { requiresBaseSelection } = useBaseFilter();

  if (requiresBaseSelection) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Orçamentos do Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <BaseRequiredAlert action="visualizar orçamentos" />
        </CardContent>
      </Card>
    );
  }

  const now = new Date();
  const startDate = format(startOfMonth(now), "yyyy-MM-dd");
  const endDate = format(endOfMonth(now), "yyyy-MM-dd");

  const { data: budgets, isLoading: budgetsLoading } = useBudgets();
  const { data: transactions, isLoading: transactionsLoading } = useTransactions({
    type: "expense",
    startDate,
    endDate,
  });

  const isLoading = budgetsLoading || transactionsLoading;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Calculate spent per category
  const spentByCategory = new Map<string, number>();
  transactions?.forEach((tx) => {
    if (tx.category_id) {
      const current = spentByCategory.get(tx.category_id) || 0;
      spentByCategory.set(tx.category_id, current + tx.amount);
    }
  });

  // Filter current month budgets and add spent amount
  const currentMonthBudgets = budgets
    ?.filter((b) => b.month === now.getMonth() + 1 && b.year === now.getFullYear())
    .map((budget) => ({
      ...budget,
      spent: spentByCategory.get(budget.category_id) || 0,
    }))
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Orçamentos do Mês</CardTitle>
        <Link to="/orcamentos">
          <Badge variant="outline" className="cursor-pointer hover:bg-secondary">
            Ver todos
          </Badge>
        </Link>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !currentMonthBudgets || currentMonthBudgets.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            Nenhum orçamento definido
          </div>
        ) : (
          currentMonthBudgets.map((budget) => {
            const percentage = Math.min((budget.spent / budget.amount) * 100, 100);
            const isOverBudget = budget.spent > budget.amount;

            return (
              <div key={budget.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground"
                      style={{ backgroundColor: budget.categories?.color || "#6366f1" }}
                    >
                      <span className="text-xs font-bold">
                        {budget.categories?.name?.charAt(0) || "?"}
                      </span>
                    </div>
                    <span className="text-sm font-medium">
                      {budget.categories?.name || "Categoria"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isOverBudget && "text-destructive"
                      )}
                    >
                      {formatCurrency(budget.spent)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {" "}
                      / {formatCurrency(budget.amount)}
                    </span>
                  </div>
                </div>
                <Progress
                  value={percentage}
                  className={cn(
                    "h-2",
                    isOverBudget && "[&>div]:bg-destructive"
                  )}
                />
                {isOverBudget && (
                  <p className="text-xs text-destructive">
                    Orçamento excedido em {formatCurrency(budget.spent - budget.amount)}
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
