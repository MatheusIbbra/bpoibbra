import { useState, useCallback } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { useCategoryAnalysisReport } from "@/hooks/useCategoryAnalysisReport";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown } from "lucide-react";

export function CategoryAnalysisContent() {
  const { requiresBaseSelection } = useBaseFilter();
  const [dateRange, setDateRange] = useState({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
  const [costCenterId, setCostCenterId] = useState<string | undefined>(undefined);
  const [selectedIncomeCategory, setSelectedIncomeCategory] = useState<string | null>(null);
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);

  const { data: costCenters } = useCostCenters();
  const { data, isLoading } = useCategoryAnalysisReport(dateRange.start, dateRange.end, costCenterId);

  if (requiresBaseSelection) {
    return <BaseRequiredAlert action="visualizar análise por categoria" />;
  }

  const incomeCategories = data?.incomeCategories || [];
  const expenseCategories = data?.expenseCategories || [];

  const INCOME_COLORS = [
    '#22c55e', '#16a34a', '#15803d', '#4ade80', '#86efac', '#34d399', '#10b981', '#059669',
    '#6ee7b7', '#a7f3d0', '#bbf7d0', '#047857', '#065f46', '#064e3b', '#14b8a6', '#0d9488',
  ];
  const EXPENSE_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#e11d48', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6',
    '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#f43f5e', '#fb923c', '#fbbf24',
  ];

  const incomeChartData = incomeCategories.map((c, i) => ({ name: c.category_name, value: c.total, color: c.category_color || INCOME_COLORS[i % INCOME_COLORS.length] }));
  const expenseChartData = expenseCategories.map((c, i) => ({ name: c.category_name, value: c.total, color: c.category_color || EXPENSE_COLORS[i % EXPENSE_COLORS.length] }));

  const selectedIncomeData = selectedIncomeCategory
    ? incomeCategories.find(c => c.category_id === selectedIncomeCategory)
    : null;
  const selectedExpenseData = selectedExpenseCategory
    ? expenseCategories.find(c => c.category_id === selectedExpenseCategory)
    : null;

  const handlePieClick = (type: "income" | "expense", index: number) => {
    const cats = type === "income" ? incomeCategories : expenseCategories;
    const cat = cats[index];
    if (!cat) return;
    if (type === "income") {
      setSelectedIncomeCategory(prev => prev === cat.category_id ? null : cat.category_id);
    } else {
      setSelectedExpenseCategory(prev => prev === cat.category_id ? null : cat.category_id);
    }
  };

  const renderCategoryCard = (
    title: string,
    icon: React.ReactNode,
    total: number,
    chartData: { name: string; value: number; color: string }[],
    categories: any[],
    selectedId: string | null,
    selectedData: any | null,
    onPieClick: (index: number) => void,
    colorClass: string
  ) => (
    <Card className="card-executive flex flex-col">
      <CardHeader className="py-3 px-4 pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            {icon}
            {title}
          </CardTitle>
          <span className={`text-lg font-bold ${colorClass}`}>{formatCurrency(total)}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">{categories.length} categorias</p>
      </CardHeader>
      <CardContent className="p-4 pt-2 flex-1 flex flex-col">
        {chartData.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sem dados no período</p>
        ) : (
          <>
            {/* Chart */}
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  onClick={(_, index) => onPieClick(index)}
                  className="cursor-pointer"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.color}
                      stroke={categories[index]?.category_id === (selectedId) ? "hsl(var(--foreground))" : "transparent"}
                      strokeWidth={categories[index]?.category_id === (selectedId) ? 2 : 0}
                      opacity={selectedId && categories[index]?.category_id !== selectedId ? 0.35 : 1}
                    />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend - always minimized, expand on click */}
            <div className="mt-2 max-h-[220px] overflow-y-auto space-y-0.5">
              {categories.map((cat, catIndex) => {
                const chartColor = chartData[catIndex]?.color || cat.category_color;
                return (
                <div key={cat.category_id || "none"}>
                  <button
                    className={`flex items-center justify-between w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-muted/40 ${
                      cat.category_id === selectedId ? "bg-muted/60 ring-1 ring-primary/20" : ""
                    }`}
                    onClick={() => {
                      if (title.includes("Receita")) {
                        setSelectedIncomeCategory(prev => prev === cat.category_id ? null : cat.category_id);
                      } else {
                        setSelectedExpenseCategory(prev => prev === cat.category_id ? null : cat.category_id);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: chartColor }} />
                      <span className="font-medium truncate">{cat.category_name}</span>
                      <Badge variant="secondary" className="text-[8px] h-3.5 px-1 shrink-0">{cat.count}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="font-medium">{formatCurrency(cat.total)}</span>
                      <span className="text-muted-foreground text-[10px]">{cat.percentage.toFixed(0)}%</span>
                    </div>
                  </button>

                  {/* Transactions for selected category */}
                  {cat.category_id === selectedId && cat.transactions && (
                    <div className="ml-5 border-l border-border/40 pl-2 space-y-0.5 my-1">
                      {cat.transactions.map((tx: any) => (
                        <button
                          key={tx.id}
                          className="flex items-center justify-between w-full text-left px-2 py-1 rounded text-[11px] hover:bg-primary/5 transition-colors"
                          onClick={() => setEditingTransaction(tx)}
                        >
                          <span className="truncate text-muted-foreground max-w-[50%]">{tx.description || "—"}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-medium ${colorClass}`}>{formatCurrency(tx.amount)}</span>
                            <span className="text-muted-foreground text-[9px]">
                              {format(parseLocalDate(tx.date), "dd/MM", { locale: ptBR })}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <PeriodSelector dateRange={dateRange} onDateRangeChange={setDateRange} />
        <Select value={costCenterId || "all"} onValueChange={(v) => setCostCenterId(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-full sm:w-[160px] h-8 text-xs">
            <SelectValue placeholder="Centro de Custo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os centros</SelectItem>
            {costCenters?.map(cc => (
              <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          <Skeleton className="h-[420px] rounded-xl" />
          <Skeleton className="h-[420px] rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
          {renderCategoryCard(
            "Receitas",
            <TrendingUp className="h-3.5 w-3.5 text-success" />,
            data?.totalIncome ?? 0,
            incomeChartData,
            incomeCategories,
            selectedIncomeCategory,
            selectedIncomeData,
            (i) => handlePieClick("income", i),
            "text-success"
          )}
          {renderCategoryCard(
            "Despesas",
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />,
            data?.totalExpense ?? 0,
            expenseChartData,
            expenseCategories,
            selectedExpenseCategory,
            selectedExpenseData,
            (i) => handlePieClick("expense", i),
            "text-destructive"
          )}
        </div>
      )}

      {editingTransaction && (
        <TransactionDialog
          open={!!editingTransaction}
          onOpenChange={(o) => !o && setEditingTransaction(null)}
          transaction={editingTransaction}
        />
      )}
    </div>
  );
}
