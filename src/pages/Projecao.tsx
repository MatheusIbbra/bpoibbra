import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePatrimonyProjection, ProjectionInputs } from "@/hooks/usePatrimonyProjection";
import { usePatrimonyConsolidation } from "@/hooks/usePatrimonyConsolidation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader2, TrendingUp, Target, Calendar } from "lucide-react";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Projecao() {
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

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);
  if (authLoading || isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const chartData = projections.all.filter((_, i) => i % 3 === 0 || i === 12 || i === 24 || i === 60).map(p => ({
    month: `${p.month}m`,
    "Nominal": p.nominalNetWorth,
    "Real (ajustado)": p.realNetWorth,
  }));

  return (
    <AppLayout title="Projeção Patrimonial">
      <div className="space-y-6">
        {/* Input Parameters */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Parâmetros da Projeção</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div><Label className="text-xs">Patrimônio Atual</Label><Input type="number" value={inputs.currentNetWorth} onChange={e => setInputs(p => ({ ...p, currentNetWorth: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Crescimento Anual (%)</Label><Input type="number" value={inputs.annualGrowthRate} onChange={e => setInputs(p => ({ ...p, annualGrowthRate: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Aporte Mensal</Label><Input type="number" value={inputs.monthlyContribution} onChange={e => setInputs(p => ({ ...p, monthlyContribution: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Inflação Anual (%)</Label><Input type="number" value={inputs.inflationRate} onChange={e => setInputs(p => ({ ...p, inflationRate: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Crescimento Despesas (%)</Label><Input type="number" value={inputs.expenseGrowthRate} onChange={e => setInputs(p => ({ ...p, expenseGrowthRate: parseFloat(e.target.value) || 0 }))} /></div>
              <div><Label className="text-xs">Despesas Mensais</Label><Input type="number" value={inputs.currentMonthlyExpenses} onChange={e => setInputs(p => ({ ...p, currentMonthlyExpenses: parseFloat(e.target.value) || 0 }))} /></div>
            </div>
          </CardContent>
        </Card>

        {/* Projection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[{ label: "12 meses", data: projections.at12, icon: Calendar },
            { label: "24 meses", data: projections.at24, icon: Target },
            { label: "60 meses", data: projections.at60, icon: TrendingUp }].map(item => (
            <Card key={item.label} className="border-l-[3px] border-l-accent">
              <CardContent className="px-5 py-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
                    <p className="text-lg font-bold"><MaskedValue>{formatCurrency(item.data?.nominalNetWorth || 0)}</MaskedValue></p>
                    <p className="text-[10px] text-muted-foreground">Real: <MaskedValue>{formatCurrency(item.data?.realNetWorth || 0)}</MaskedValue></p>
                    <p className="text-[10px] text-muted-foreground">Sustentabilidade: {item.data?.sustainabilityIndex.toFixed(0)}%</p>
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-accent/8 flex items-center justify-center"><item.icon className="h-4 w-4 text-accent" /></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Projection Chart */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Evolução Patrimonial Projetada</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Line type="monotone" dataKey="Nominal" stroke="hsl(210,100%,36%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Real (ajustado)" stroke="hsl(160,60%,38%)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
