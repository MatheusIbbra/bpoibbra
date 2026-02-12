import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePatrimonyProjection, ProjectionInputs } from "@/hooks/usePatrimonyProjection";
import { usePatrimonyConsolidation } from "@/hooks/usePatrimonyConsolidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { Loader2, Sparkles, Target, Clock } from "lucide-react";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Simulacoes() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { consolidation, isLoading } = usePatrimonyConsolidation();

  const [inputs, setInputs] = useState<ProjectionInputs>({
    currentNetWorth: 0,
    annualGrowthRate: 8,
    monthlyContribution: 5000,
    inflationRate: 4.5,
    expenseGrowthRate: 3,
    currentMonthlyExpenses: 15000,
  });

  useEffect(() => {
    if (consolidation) setInputs(p => ({ ...p, currentNetWorth: consolidation.netWorth }));
  }, [consolidation]);

  const projections = usePatrimonyProjection(inputs);

  // Calcular meses até independência financeira (renda passiva >= despesas)
  const monthsToFI = useMemo(() => {
    const idx = projections.all.findIndex(p => p.sustainabilityIndex >= 100);
    return idx >= 0 ? idx : null;
  }, [projections]);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);
  if (authLoading || isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const chartData = projections.all.filter((_, i) => i % 2 === 0 || i === 60).map(p => ({
    month: `${p.month}m`,
    "Patrimônio": p.nominalNetWorth,
    "Despesas Acum.": p.monthlyExpenses * p.month,
    "Sustentabilidade": p.sustainabilityIndex,
  }));

  const updateField = (field: keyof ProjectionInputs, value: number) => setInputs(p => ({ ...p, [field]: value }));

  return (
    <AppLayout title="Simulador de Cenários">
      <div className="space-y-6">
        {/* Simulator Controls */}
        <Card className="border-l-[3px] border-l-accent">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-accent" />Ajuste os parâmetros para simular cenários</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label className="text-xs">Renda Ativa Mensal</Label><span className="text-xs font-mono text-muted-foreground">{formatCurrency(inputs.monthlyContribution)}</span></div>
                <Slider value={[inputs.monthlyContribution]} onValueChange={([v]) => updateField("monthlyContribution", v)} min={0} max={100000} step={500} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label className="text-xs">Despesas Mensais</Label><span className="text-xs font-mono text-muted-foreground">{formatCurrency(inputs.currentMonthlyExpenses)}</span></div>
                <Slider value={[inputs.currentMonthlyExpenses]} onValueChange={([v]) => updateField("currentMonthlyExpenses", v)} min={0} max={100000} step={500} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label className="text-xs">Crescimento Anual (%)</Label><span className="text-xs font-mono text-muted-foreground">{inputs.annualGrowthRate}%</span></div>
                <Slider value={[inputs.annualGrowthRate]} onValueChange={([v]) => updateField("annualGrowthRate", v)} min={0} max={30} step={0.5} />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between"><Label className="text-xs">Inflação Anual (%)</Label><span className="text-xs font-mono text-muted-foreground">{inputs.inflationRate}%</span></div>
                <Slider value={[inputs.inflationRate]} onValueChange={([v]) => updateField("inflationRate", v)} min={0} max={20} step={0.5} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1"><Target className="h-4 w-4 text-accent" /><p className="text-xs text-muted-foreground font-medium">Patrimônio em 60m</p></div>
              <p className="text-xl font-bold"><MaskedValue>{formatCurrency(projections.at60?.nominalNetWorth || 0)}</MaskedValue></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-accent" /><p className="text-xs text-muted-foreground font-medium">Independência Financeira</p></div>
              <p className="text-xl font-bold">{monthsToFI !== null ? `${monthsToFI} meses` : "> 60 meses"}</p>
              {monthsToFI !== null && <p className="text-[10px] text-success font-medium">≈ {(monthsToFI / 12).toFixed(1)} anos</p>}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-5 py-4">
              <p className="text-xs text-muted-foreground font-medium">Sustentabilidade em 60m</p>
              <p className={`text-xl font-bold ${(projections.at60?.sustainabilityIndex || 0) >= 100 ? "text-success" : "text-warning"}`}>
                {projections.at60?.sustainabilityIndex.toFixed(0)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução do Cenário Simulado</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                <Tooltip formatter={(v: number, name: string) => name === "Sustentabilidade" ? `${v.toFixed(0)}%` : formatCurrency(v)} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="Patrimônio" stroke="hsl(210,100%,36%)" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="Sustentabilidade" stroke="hsl(160,60%,38%)" strokeWidth={1.5} dot={false} />
                <ReferenceLine yAxisId="right" y={100} stroke="hsl(38,92%,50%)" strokeDasharray="6 3" label={{ value: "Independência", fontSize: 10, fill: "hsl(38,92%,50%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
