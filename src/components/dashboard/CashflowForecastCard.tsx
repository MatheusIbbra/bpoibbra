import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCashflowForecast } from "@/hooks/useCashflowForecast";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, CalendarClock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CashflowForecastCard() {
  const { data: forecast, isLoading } = useCashflowForecast();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Previsão de Caixa</CardTitle>
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  if (!forecast || !forecast.forecast.length) return null;

  const isPositiveNet = forecast.net_daily >= 0;
  const chartData = forecast.forecast.map((entry) => ({
    ...entry,
    dateLabel: format(parseISO(entry.date), "dd/MM", { locale: ptBR }),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Previsão de Caixa (90 dias)</CardTitle>
          </div>
          <Badge variant={isPositiveNet ? "default" : "destructive"}>
            {isPositiveNet ? "Tendência positiva" : "Atenção"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Média diária receita</p>
            <p className="text-sm font-semibold text-success">
              <MaskedValue>{formatCurrency(forecast.avg_daily_income)}</MaskedValue>
            </p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Média diária despesa</p>
            <p className="text-sm font-semibold text-destructive">
              <MaskedValue>{formatCurrency(forecast.avg_daily_expense)}</MaskedValue>
            </p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo líquido/dia</p>
            <div className="flex items-center justify-center gap-1">
              {isPositiveNet ? (
                <TrendingUp className="h-3 w-3 text-success" />
              ) : (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              <p className={`text-sm font-semibold ${isPositiveNet ? "text-success" : "text-destructive"}`}>
                <MaskedValue>{formatCurrency(forecast.net_daily)}</MaskedValue>
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), "Saldo projetado"]}
                labelFormatter={(label) => `Data: ${label}`}
              />
              <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
              <Line
                type="monotone"
                dataKey="projected_balance"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
