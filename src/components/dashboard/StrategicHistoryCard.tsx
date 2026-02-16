import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStrategicHistory } from "@/hooks/useStrategicHistory";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { History, Loader2, Camera, TrendingUp, TrendingDown, Shield } from "lucide-react";

export function StrategicHistoryCard() {
  const { history, isLoading, generateSnapshot } = useStrategicHistory();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Histórico Estratégico</CardTitle>
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-64 w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = history.map((s) => {
    const month = new Date(s.snapshot_month);
    return {
      month: month.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      score: s.financial_health_score ?? 0,
      runway: s.runway_months ?? 0,
      balance: s.total_balance,
      savings: s.savings_rate ?? 0,
    };
  });

  const latest = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : null;
  const scoreDelta = latest && previous
    ? (latest.financial_health_score ?? 0) - (previous.financial_health_score ?? 0)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Histórico Estratégico</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => generateSnapshot.mutate()}
            disabled={generateSnapshot.isPending}
          >
            {generateSnapshot.isPending ? (
              <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Salvando...</>
            ) : (
              <><Camera className="h-3 w-3 mr-1" /> Snapshot</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhum histórico registrado ainda.</p>
            <p className="text-[10px] mt-1">Clique em "Snapshot" para salvar o primeiro registro mensal.</p>
          </div>
        ) : (
          <>
            {/* Summary KPIs */}
            {latest && (
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center gap-1">
                    <Shield className="h-3 w-3 text-primary" />
                    <span className="text-lg font-bold">{latest.financial_health_score ?? '-'}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Score</p>
                  {scoreDelta !== 0 && (
                    <div className={`flex items-center justify-center gap-0.5 text-[10px] ${scoreDelta > 0 ? 'text-success' : 'text-destructive'}`}>
                      {scoreDelta > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(0)}
                    </div>
                  )}
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{latest.runway_months !== null ? (latest.runway_months > 98 ? '∞' : latest.runway_months.toFixed(0)) : '-'}</p>
                  <p className="text-[10px] text-muted-foreground">Runway (m)</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{latest.savings_rate !== null ? `${latest.savings_rate.toFixed(0)}%` : '-'}</p>
                  <p className="text-[10px] text-muted-foreground">Poupança</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold text-xs"><MaskedValue>{formatCurrency(latest.total_balance)}</MaskedValue></p>
                  <p className="text-[10px] text-muted-foreground">Patrimônio</p>
                </div>
              </div>
            )}

            {/* Chart */}
            {chartData.length > 1 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="score" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="balance" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(value: number, name: string) => {
                        if (name === 'balance') return [formatCurrency(value), 'Patrimônio'];
                        if (name === 'score') return [value, 'Score'];
                        if (name === 'runway') return [`${value}m`, 'Runway'];
                        return [value, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 10 }} formatter={(v) => v === 'score' ? 'Score' : v === 'balance' ? 'Patrimônio' : 'Runway'} />
                    <Line yAxisId="score" type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                    <Line yAxisId="balance" type="monotone" dataKey="balance" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
