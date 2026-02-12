import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { usePatrimonyIndicators } from "@/hooks/usePatrimonyIndicators";
import { usePatrimonyConsolidation } from "@/hooks/usePatrimonyConsolidation";
import { Card, CardContent } from "@/components/ui/card";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { Loader2, TrendingUp, TrendingDown, Droplets, Shield, Target, PieChart as PieIcon } from "lucide-react";

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export default function Indicadores() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { isLoading } = usePatrimonyConsolidation();
  const indicators = usePatrimonyIndicators();

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [user, authLoading, navigate]);
  if (authLoading || isLoading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  const cards = [
    {
      title: "Patrimônio Líquido",
      value: formatCurrency(indicators.netWorth),
      icon: Shield,
      color: "accent",
      isCurrency: true,
    },
    {
      title: "Crescimento Mensal",
      value: `${indicators.monthlyGrowth >= 0 ? "+" : ""}${indicators.monthlyGrowth.toFixed(1)}%`,
      icon: indicators.monthlyGrowth >= 0 ? TrendingUp : TrendingDown,
      color: indicators.monthlyGrowth >= 0 ? "success" : "destructive",
    },
    {
      title: "Crescimento 12 Meses",
      value: `${indicators.yearlyGrowth >= 0 ? "+" : ""}${indicators.yearlyGrowth.toFixed(1)}%`,
      icon: indicators.yearlyGrowth >= 0 ? TrendingUp : TrendingDown,
      color: indicators.yearlyGrowth >= 0 ? "success" : "destructive",
    },
    {
      title: "Índice de Liquidez",
      value: `${indicators.liquidityIndex.toFixed(1)}x`,
      subtitle: "meses de despesas cobertos",
      icon: Droplets,
      color: indicators.liquidityIndex >= 6 ? "success" : indicators.liquidityIndex >= 3 ? "warning" : "destructive",
    },
    {
      title: "Índice de Sustentabilidade",
      value: `${indicators.sustainabilityIndex.toFixed(0)}%`,
      subtitle: "renda passiva / despesas",
      icon: Target,
      color: indicators.sustainabilityIndex >= 100 ? "success" : "warning",
    },
    {
      title: "Concentração de Ativos",
      value: `${indicators.concentrationIndex.toFixed(0)}%`,
      subtitle: "maior classe de ativo",
      icon: PieIcon,
      color: indicators.concentrationIndex > 60 ? "warning" : "success",
    },
  ];

  return (
    <AppLayout title="Indicadores Estratégicos">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <Card key={i} className="hover:shadow-executive-lg transition-all duration-300 hover:-translate-y-0.5">
            <CardContent className="px-6 py-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{card.title}</p>
                  <p className={`text-2xl font-bold ${
                    card.color === "success" ? "text-success" :
                    card.color === "destructive" ? "text-destructive" :
                    card.color === "warning" ? "text-warning" : ""
                  }`}>
                    {card.isCurrency ? <MaskedValue>{card.value}</MaskedValue> : card.value}
                  </p>
                  {card.subtitle && <p className="text-[10px] text-muted-foreground">{card.subtitle}</p>}
                </div>
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                  card.color === "success" ? "bg-success/8" :
                  card.color === "destructive" ? "bg-destructive/8" :
                  card.color === "warning" ? "bg-warning/8" : "bg-accent/8"
                }`}>
                  <card.icon className={`h-5 w-5 ${
                    card.color === "success" ? "text-success" :
                    card.color === "destructive" ? "text-destructive" :
                    card.color === "warning" ? "text-warning" : "text-accent"
                  }`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
