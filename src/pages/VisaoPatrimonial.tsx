import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePatrimonyConsolidation } from "@/hooks/usePatrimonyConsolidation";
import { usePatrimonyIndicators } from "@/hooks/usePatrimonyIndicators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { TrendingUp, TrendingDown, Landmark, Building2, PiggyBank, Shield, BarChart3, Droplets } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { Loader2 } from "lucide-react";

const ASSET_TYPE_LABELS: Record<string, string> = {
  conta: "Contas", investimento: "Investimentos", imovel: "Imóveis", participacao: "Participações", outro: "Outros",
};

const LIQUIDITY_LABELS: Record<string, string> = {
  alta: "Alta", media: "Média", baixa: "Baixa",
};

const CHART_COLORS = ["hsl(210,100%,36%)", "hsl(213,80%,13%)", "hsl(160,60%,38%)", "hsl(38,92%,50%)", "hsl(14,100%,54%)"];

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function VisaoPatrimonial() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { consolidation, history, isLoading } = usePatrimonyConsolidation();
  const indicators = usePatrimonyIndicators();

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);
  if (authLoading || isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const c = consolidation || { totalAssets: 0, totalLiabilities: 0, netWorth: 0, byEntity: [], assetsByType: {}, assetsByLiquidity: {}, highLiquidityAssets: 0 };

  const assetTypeData = Object.entries(c.assetsByType).map(([k, v]) => ({ name: ASSET_TYPE_LABELS[k] || k, value: v }));
  const liquidityData = Object.entries(c.assetsByLiquidity).map(([k, v]) => ({ name: LIQUIDITY_LABELS[k] || k, value: v }));
  const historyData = history.map(h => ({ period: h.period, "Patrimônio Líquido": h.net_worth, Ativos: h.total_assets, Passivos: h.total_liabilities }));

  return (
    <AppLayout title="Visão Patrimonial">
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-[3px] border-l-accent">
            <CardContent className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Patrimônio Líquido</p>
                  <p className="text-xl font-bold"><MaskedValue>{formatCurrency(c.netWorth)}</MaskedValue></p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-accent/8 flex items-center justify-center"><Landmark className="h-5 w-5 text-accent" /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Total Ativos</p>
                  <p className="text-xl font-bold text-success"><MaskedValue>{formatCurrency(c.totalAssets)}</MaskedValue></p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-success/8 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-success" /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Total Passivos</p>
                  <p className="text-xl font-bold text-destructive"><MaskedValue>{formatCurrency(c.totalLiabilities)}</MaskedValue></p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-destructive/8 flex items-center justify-center"><TrendingDown className="h-5 w-5 text-destructive" /></div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Crescimento Mês</p>
                  <p className={`text-xl font-bold ${indicators.monthlyGrowth >= 0 ? "text-success" : "text-destructive"}`}>
                    {indicators.monthlyGrowth >= 0 ? "+" : ""}{indicators.monthlyGrowth.toFixed(1)}%
                  </p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-accent/8 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-accent" /></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Asset Distribution */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Distribuição por Tipo de Ativo</CardTitle></CardHeader>
            <CardContent>
              {assetTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={assetTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {assetTypeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum ativo cadastrado</p>}
            </CardContent>
          </Card>

          {/* Liquidity Distribution */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Distribuição por Liquidez</CardTitle></CardHeader>
            <CardContent>
              {liquidityData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={liquidityData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {liquidityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum ativo cadastrado</p>}
            </CardContent>
          </Card>
        </div>

        {/* Historical Evolution */}
        {historyData.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Evolução Patrimonial</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="Patrimônio Líquido" stroke="hsl(210,100%,36%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Ativos" stroke="hsl(160,60%,38%)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="Passivos" stroke="hsl(14,100%,54%)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Entity Breakdown */}
        {c.byEntity.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Patrimônio por Entidade</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {c.byEntity.map(e => (
                  <div key={e.entity.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-accent/8 flex items-center justify-center">
                        {e.entity.entity_type === "pf" ? <Shield className="h-4 w-4 text-accent" /> :
                         e.entity.entity_type === "holding" ? <Building2 className="h-4 w-4 text-accent" /> :
                         <PiggyBank className="h-4 w-4 text-accent" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{e.entity.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">{e.entity.entity_type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold"><MaskedValue>{formatCurrency(e.netWorth)}</MaskedValue></p>
                      <p className="text-[10px] text-muted-foreground">
                        A: {formatCurrency(e.totalAssets)} | P: {formatCurrency(e.totalLiabilities)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Strategic Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="px-5 py-4">
              <p className="text-xs text-muted-foreground font-medium">Crescimento 12m</p>
              <p className={`text-lg font-bold ${indicators.yearlyGrowth >= 0 ? "text-success" : "text-destructive"}`}>
                {indicators.yearlyGrowth >= 0 ? "+" : ""}{indicators.yearlyGrowth.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-5 py-4">
              <div className="flex items-center gap-2 mb-1">
                <Droplets className="h-3.5 w-3.5 text-accent" />
                <p className="text-xs text-muted-foreground font-medium">Índice Liquidez</p>
              </div>
              <p className="text-lg font-bold">{indicators.liquidityIndex.toFixed(1)}x</p>
              <p className="text-[10px] text-muted-foreground">meses cobertos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-5 py-4">
              <p className="text-xs text-muted-foreground font-medium">Sustentabilidade</p>
              <p className={`text-lg font-bold ${indicators.sustainabilityIndex >= 100 ? "text-success" : "text-warning"}`}>
                {indicators.sustainabilityIndex.toFixed(0)}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-5 py-4">
              <p className="text-xs text-muted-foreground font-medium">Concentração</p>
              <p className={`text-lg font-bold ${indicators.concentrationIndex > 60 ? "text-warning" : "text-success"}`}>
                {indicators.concentrationIndex.toFixed(0)}%
              </p>
              <p className="text-[10px] text-muted-foreground">maior classe de ativo</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
