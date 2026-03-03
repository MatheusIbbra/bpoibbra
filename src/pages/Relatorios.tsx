import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { Loader2 } from "lucide-react";

// Report components
import { AnaliseOrcamentoContent } from "@/components/reports/AnaliseOrcamentoContent";
import { DREContent } from "@/components/reports/DREContent";
import { DemonstrativoContent } from "@/components/reports/DemonstrativoContent";
import { FluxoCaixaContent } from "@/components/reports/FluxoCaixaContent";
import { MovimentacoesReportContent } from "@/components/reports/MovimentacoesReportContent";
import { FinancialTypeReportContent } from "@/components/reports/FinancialTypeReportContent";
import { CategoryAnalysisContent } from "@/components/reports/CategoryAnalysisContent";

// Strategic analysis cards
import { StructuredLiquidityCard } from "@/components/dashboard/StructuredLiquidityCard";
import { PersonalRunwayCard } from "@/components/dashboard/PersonalRunwayCard";
import { CashflowForecastCard } from "@/components/dashboard/CashflowForecastCard";
import { LifestylePatternCard } from "@/components/dashboard/LifestylePatternCard";
import { FinancialSimulatorCard } from "@/components/dashboard/FinancialSimulatorCard";
import { PatrimonyEvolutionCard } from "@/components/dashboard/PatrimonyEvolutionCard";
import { AnomalyDetectionCard } from "@/components/dashboard/AnomalyDetectionCard";
import { StrategicHistoryCard } from "@/components/dashboard/StrategicHistoryCard";
import { MacroSimulationCard } from "@/components/dashboard/MacroSimulationCard";
import { StaggerGrid, StaggerItem } from "@/components/ui/motion";

const TITLE_MAP: Record<string, string> = {
  movimentacoes: "Movimentações",
  fluxo: "Fluxo de Caixa",
  dre: "DRE",
  analise: "Análise de Orçamento",
  demonstrativo: "Demonstrativo Financeiro",
  "tipo-financeiro": "Tipo Financeiro",
  categorias: "Análise de Categorias",
  estrategico: "Análises Estratégicas",
};

export default function Relatorios() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { hasFeature } = useFeatureFlags();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "movimentacoes";

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const pageTitle = TITLE_MAP[tab] || "Relatórios";

  return (
    <AppLayout title={pageTitle}>
      <div className="space-y-4">
        {tab === "movimentacoes" && <MovimentacoesReportContent />}
        {tab === "analise" && <AnaliseOrcamentoContent />}
        {tab === "dre" && <DREContent />}
        {tab === "demonstrativo" && <DemonstrativoContent />}
        {tab === "fluxo" && <FluxoCaixaContent />}
        {tab === "tipo-financeiro" && <FinancialTypeReportContent />}
        {tab === "categorias" && <CategoryAnalysisContent />}
        {tab === "estrategico" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Análises Estratégicas
              </h2>
              <p className="text-sm text-muted-foreground">
                Métricas profundas de liquidez, sustentabilidade e projeções financeiras.
              </p>
            </div>
            {(hasFeature("strategic_history") || hasFeature("macro_simulation")) && (
              <StaggerGrid className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                {hasFeature("strategic_history") && <StaggerItem><StrategicHistoryCard /></StaggerItem>}
                {hasFeature("macro_simulation") && <StaggerItem><MacroSimulationCard /></StaggerItem>}
              </StaggerGrid>
            )}
            <StaggerGrid className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              <StaggerItem><PatrimonyEvolutionCard /></StaggerItem>
              {hasFeature("anomaly_detection") && <StaggerItem><AnomalyDetectionCard /></StaggerItem>}
            </StaggerGrid>
            <StaggerGrid className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              <StaggerItem><StructuredLiquidityCard /></StaggerItem>
              <StaggerItem><PersonalRunwayCard /></StaggerItem>
            </StaggerGrid>
            <StaggerGrid className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              {hasFeature("cashflow_forecast") && <StaggerItem><CashflowForecastCard /></StaggerItem>}
              <StaggerItem><LifestylePatternCard /></StaggerItem>
            </StaggerGrid>
            {hasFeature("financial_simulator") && <FinancialSimulatorCard />}
          </div>
        )}
      </div>
    </AppLayout>
  );
}