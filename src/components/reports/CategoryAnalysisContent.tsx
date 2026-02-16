import { useState } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { useCategoryAnalysisReport } from "@/hooks/useCategoryAnalysisReport";
import { useCostCenters } from "@/hooks/useCostCenters";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { formatCurrency, parseLocalDate } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";

export function CategoryAnalysisContent() {
  const { requiresBaseSelection } = useBaseFilter();
  const [dateRange, setDateRange] = useState({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) });
  const [costCenterId, setCostCenterId] = useState<string | undefined>(undefined);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState("expense");

  const { data: costCenters } = useCostCenters();
  const { data, isLoading } = useCategoryAnalysisReport(dateRange.start, dateRange.end, costCenterId);

  if (requiresBaseSelection) {
    return <BaseRequiredAlert action="visualizar análise por categoria" />;
  }

  const categories = viewTab === "income" ? data?.incomeCategories : data?.expenseCategories;

  const chartData = (categories || []).map(c => ({
    name: c.category_name,
    value: c.total,
    color: c.category_color,
  }));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <PeriodSelector dateRange={dateRange} onDateRangeChange={setDateRange} />
        <Select
          value={costCenterId || "all"}
          onValueChange={(v) => setCostCenterId(v === "all" ? undefined : v)}
        >
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

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2">
        <Card className="card-executive">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-success" />
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">Receitas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-success">{formatCurrency(data?.totalIncome ?? 0)}</p>
            <p className="text-[10px] text-muted-foreground">{data?.incomeCategories?.length ?? 0} categorias</p>
          </CardContent>
        </Card>
        <Card className="card-executive">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">Despesas</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-destructive">{formatCurrency(data?.totalExpense ?? 0)}</p>
            <p className="text-[10px] text-muted-foreground">{data?.expenseCategories?.length ?? 0} categorias</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Income/Expense */}
      <Tabs value={viewTab} onValueChange={setViewTab}>
        <TabsList className="h-8">
          <TabsTrigger value="expense" className="text-xs gap-1">
            <TrendingDown className="h-3 w-3" /> Despesas
          </TabsTrigger>
          <TabsTrigger value="income" className="text-xs gap-1">
            <TrendingUp className="h-3 w-3" /> Receitas
          </TabsTrigger>
        </TabsList>

        <TabsContent value={viewTab} className="mt-4">
          {isLoading ? (
            <Skeleton className="h-[300px] rounded-xl" />
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-1 lg:grid-cols-2">
              {/* Donut Chart */}
              <Card className="card-executive">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Distribuição por Categoria</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  {chartData.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Sem dados no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend
                          formatter={(value) => <span className="text-xs">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Detail Table */}
              <Card className="card-executive">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Detalhamento</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px]">
                        <TableHead className="whitespace-nowrap">Categoria</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">%</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(categories || []).map(cat => (
                        <>
                          <TableRow
                            key={cat.category_id || "none"}
                            className="text-xs cursor-pointer hover:bg-muted/30"
                            onClick={() => setExpandedCategory(
                              expandedCategory === cat.category_id ? null : cat.category_id
                            )}
                          >
                            <TableCell className="py-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-3 w-3 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.category_color }}
                                />
                                <span className="font-medium">{cat.category_name}</span>
                                <Badge variant="secondary" className="text-[9px] h-4 px-1">{cat.count}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(cat.total)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground hidden sm:table-cell">
                              {cat.percentage.toFixed(1)}%
                            </TableCell>
                            <TableCell>
                              {expandedCategory === cat.category_id ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedCategory === cat.category_id && cat.transactions.map(tx => (
                            <TableRow key={tx.id} className="text-[11px] bg-muted/20">
                              <TableCell className="py-1 pl-8">
                                {tx.description || "—"}
                              </TableCell>
                              <TableCell className="text-right py-1">
                                {formatCurrency(tx.amount)}
                              </TableCell>
                              <TableCell className="text-right py-1 text-muted-foreground">
                                {format(parseLocalDate(tx.date), "dd/MM", { locale: ptBR })}
                              </TableCell>
                              <TableCell className="py-1 text-muted-foreground text-[10px]">
                                {tx.account_name || ""}
                              </TableCell>
                            </TableRow>
                          ))}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
