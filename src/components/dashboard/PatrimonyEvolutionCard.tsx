import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatrimonyEvolution } from "@/hooks/usePatrimonyEvolution";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { LineChart, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

export function PatrimonyEvolutionCard() {
  const { data, isLoading } = usePatrimonyEvolution();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Evolução Patrimonial</CardTitle>
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data || data.monthly_data.length === 0) return null;

  const chartData = data.monthly_data.map((m) => ({
    month: new Date(m.month).toLocaleDateString("pt-BR", { month: "short" }),
    acumulado: m.cumulative_net,
    receita: m.income,
    despesa: m.expense,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LineChart className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Evolução Patrimonial 12M</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {data.growth_pct >= 0 ? (
              <TrendingUp className="h-3.5 w-3.5 text-success" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className={`text-xs font-semibold ${data.growth_pct >= 0 ? "text-success" : "text-destructive"}`}>
              {data.growth_pct >= 0 ? "+" : ""}{data.growth_pct.toFixed(1)}%
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>12 meses atrás: <MaskedValue>{formatCurrency(data.estimated_12m_ago)}</MaskedValue></span>
          <span>Atual: <MaskedValue>{formatCurrency(data.current_patrimony)}</MaskedValue></span>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="patrimonyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis hide />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Area
                type="monotone"
                dataKey="acumulado"
                stroke="hsl(var(--accent))"
                fill="url(#patrimonyGrad)"
                strokeWidth={2}
                name="Acumulado"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
