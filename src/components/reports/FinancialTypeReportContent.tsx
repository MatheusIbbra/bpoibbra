import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useFinancialTypeReport } from "@/hooks/useFinancialTypeReport";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

const COLORS = {
  fixa: "hsl(var(--primary))",
  variavel_recorrente: "hsl(var(--chart-2))",
  variavel_programada: "hsl(var(--chart-3))",
};

const COLOR_HEX = ["#6366f1", "#f59e0b", "#10b981"];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function FinancialTypeReportContent() {
  const { requiresBaseSelection } = useBaseFilter();
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });

  const { data, isLoading } = useFinancialTypeReport(dateRange.start, dateRange.end);

  if (requiresBaseSelection) {
    return (
      <div className="space-y-4">
        <BaseRequiredAlert action="gerar relatórios" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <PeriodSelector dateRange={dateRange} onDateRangeChange={setDateRange} />
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Receitas</CardTitle>
                <TrendingUp className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className="text-lg font-bold text-success">{formatCurrency(data?.totalIncome || 0)}</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Total Despesas</CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className="text-lg font-bold text-destructive">{formatCurrency(data?.totalExpense || 0)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Donut Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  Receitas por Tipo Financeiro
                  <Badge variant="secondary" className="text-xs">Rosca</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.incomeSummaries.filter(s => s.total > 0) || []}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {data?.incomeSummaries.filter(s => s.total > 0).map((_, i) => (
                          <Cell key={i} fill={COLOR_HEX[i % COLOR_HEX.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {data?.incomeSummaries.map((s, i) => (
                    <div key={s.financial_type} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX[i] }} />
                        <span>{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(s.total)}</span>
                        <span className="text-muted-foreground">({s.percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  Despesas por Tipo Financeiro
                  <Badge variant="secondary" className="text-xs">Rosca</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data?.expenseSummaries.filter(s => s.total > 0) || []}
                        dataKey="total"
                        nameKey="label"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                      >
                        {data?.expenseSummaries.filter(s => s.total > 0).map((_, i) => (
                          <Cell key={i} fill={COLOR_HEX[i % COLOR_HEX.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {data?.expenseSummaries.map((s, i) => (
                    <div key={s.financial_type} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_HEX[i] }} />
                        <span>{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(s.total)}</span>
                        <span className="text-muted-foreground">({s.percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Evolution Chart */}
          {data?.monthlyData && data.monthlyData.length > 1 && (
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Evolução Mensal por Tipo Financeiro (Despesas)</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="fixa_expense" name="Fixa" fill={COLOR_HEX[0]} stackId="expense" />
                      <Bar dataKey="variavel_recorrente_expense" name="Var. Recorrente" fill={COLOR_HEX[1]} stackId="expense" />
                      <Bar dataKey="variavel_programada_expense" name="Var. Programada" fill={COLOR_HEX[2]} stackId="expense" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
