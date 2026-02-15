import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancialSimulator, SimulationResult } from "@/hooks/useFinancialSimulator";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { Calculator, Loader2, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export function FinancialSimulatorCard() {
  const { simulations, isLoading, runSimulation } = useFinancialSimulator();
  const [months, setMonths] = useState(12);
  const [revenueGrowth, setRevenueGrowth] = useState(5);
  const [expenseGrowth, setExpenseGrowth] = useState(3);
  const [showForm, setShowForm] = useState(false);

  const latestSimulation = simulations[0];
  const results: SimulationResult[] = latestSimulation?.results
    ? (Array.isArray(latestSimulation.results) ? latestSimulation.results : []) as SimulationResult[]
    : [];

  const handleRun = () => {
    runSimulation.mutate({
      name: `Simulação ${months}m (+${revenueGrowth}% rec / +${expenseGrowth}% desp)`,
      months_ahead: months,
      revenue_growth_rate: revenueGrowth,
      expense_increase_rate: expenseGrowth,
    });
    setShowForm(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Simulador Financeiro</CardTitle>
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-48 w-full" /></CardContent>
      </Card>
    );
  }

  const chartData = results.map((r) => ({
    ...r,
    dateLabel: (() => {
      try {
        return format(parseISO(r.date), "MMM/yy", { locale: ptBR });
      } catch {
        return `M${r.month}`;
      }
    })(),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Simulador Financeiro</CardTitle>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Fechar" : "Nova Simulação"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="p-3 rounded-lg border space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Horizonte: {months} meses</Label>
              <Slider value={[months]} onValueChange={([v]) => setMonths(v)} min={6} max={24} step={1} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Crescimento receita (%/mês)</Label>
                <Input
                  type="number"
                  value={revenueGrowth}
                  onChange={(e) => setRevenueGrowth(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aumento despesa (%/mês)</Label>
                <Input
                  type="number"
                  value={expenseGrowth}
                  onChange={(e) => setExpenseGrowth(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <Button onClick={handleRun} disabled={runSimulation.isPending} size="sm" className="w-full h-8 text-xs">
              {runSimulation.isPending ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Gerando...</>
              ) : (
                <><TrendingUp className="h-3 w-3 mr-1" /> Simular</>
              )}
            </Button>
          </div>
        )}

        {results.length > 0 ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name === "projected_balance" ? "Saldo" : name === "projected_revenue" ? "Receita" : "Despesa",
                  ]}
                />
                <Legend
                  formatter={(value) =>
                    value === "projected_balance" ? "Saldo" : value === "projected_revenue" ? "Receita" : "Despesa"
                  }
                  wrapperStyle={{ fontSize: 10 }}
                />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="projected_revenue" stroke="hsl(var(--success))" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="projected_expenses" stroke="hsl(var(--destructive))" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="projected_balance" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Calculator className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Nenhuma simulação gerada ainda.</p>
            <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={() => setShowForm(true)}>
              Criar primeira simulação
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
