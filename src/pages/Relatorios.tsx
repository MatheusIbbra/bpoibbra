import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Receipt, BarChart3, FileText, PieChart, CircleDollarSign, Layers, Tags, Lightbulb } from "lucide-react";

// Report components
import { AnaliseOrcamentoContent } from "@/components/reports/AnaliseOrcamentoContent";
import { DREContent } from "@/components/reports/DREContent";
import { DemonstrativoContent } from "@/components/reports/DemonstrativoContent";
import { FluxoCaixaContent } from "@/components/reports/FluxoCaixaContent";
import { MovimentacoesReportContent } from "@/components/reports/MovimentacoesReportContent";
import { FinancialTypeReportContent } from "@/components/reports/FinancialTypeReportContent";
import { CategoryAnalysisContent } from "@/components/reports/CategoryAnalysisContent";

// Strategic analysis cards (moved from dashboard)
import { StructuredLiquidityCard } from "@/components/dashboard/StructuredLiquidityCard";
import { PersonalRunwayCard } from "@/components/dashboard/PersonalRunwayCard";
import { CashflowForecastCard } from "@/components/dashboard/CashflowForecastCard";
import { LifestylePatternCard } from "@/components/dashboard/LifestylePatternCard";
import { FinancialSimulatorCard } from "@/components/dashboard/FinancialSimulatorCard";
import { StaggerGrid, StaggerItem } from "@/components/ui/motion";

export default function Relatorios() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("movimentacoes");

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

  return (
    <AppLayout title="Relatórios">
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap gap-1">
            <TabsTrigger value="movimentacoes" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <Receipt className="h-3.5 w-3.5 shrink-0" />
              Movimentações
            </TabsTrigger>
            <TabsTrigger value="fluxo" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <CircleDollarSign className="h-3.5 w-3.5 shrink-0" />
              Fluxo Caixa
            </TabsTrigger>
            <TabsTrigger value="dre" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <PieChart className="h-3.5 w-3.5 shrink-0" />
              DRE
            </TabsTrigger>
            <TabsTrigger value="analise" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5 shrink-0" />
              Orçamento
            </TabsTrigger>
            <TabsTrigger value="demonstrativo" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              Demonstrativo
            </TabsTrigger>
            <TabsTrigger value="tipo-financeiro" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <Layers className="h-3.5 w-3.5 shrink-0" />
              Tipo Financeiro
            </TabsTrigger>
            <TabsTrigger value="categorias" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <Tags className="h-3.5 w-3.5 shrink-0" />
              Análise Categorias
            </TabsTrigger>
            <TabsTrigger value="estrategico" className="gap-1.5 data-[state=active]:bg-background text-xs sm:text-sm">
              <Lightbulb className="h-3.5 w-3.5 shrink-0" />
              Análises Estratégicas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="movimentacoes" className="mt-4">
            <MovimentacoesReportContent />
          </TabsContent>
          
          <TabsContent value="analise" className="mt-4">
            <AnaliseOrcamentoContent />
          </TabsContent>
          
          <TabsContent value="dre" className="mt-4">
            <DREContent />
          </TabsContent>
          
          <TabsContent value="demonstrativo" className="mt-4">
            <DemonstrativoContent />
          </TabsContent>
          
          <TabsContent value="fluxo" className="mt-4">
            <FluxoCaixaContent />
          </TabsContent>

          <TabsContent value="tipo-financeiro" className="mt-4">
            <FinancialTypeReportContent />
          </TabsContent>

          <TabsContent value="categorias" className="mt-4">
            <CategoryAnalysisContent />
          </TabsContent>

          <TabsContent value="estrategico" className="mt-4">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Análises Estratégicas
                </h2>
                <p className="text-sm text-muted-foreground">
                  Métricas profundas de liquidez, sustentabilidade e projeções financeiras.
                </p>
              </div>
              <StaggerGrid className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <StaggerItem><StructuredLiquidityCard /></StaggerItem>
                <StaggerItem><PersonalRunwayCard /></StaggerItem>
              </StaggerGrid>
              <StaggerGrid className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                <StaggerItem><CashflowForecastCard /></StaggerItem>
                <StaggerItem><LifestylePatternCard /></StaggerItem>
              </StaggerGrid>
              <FinancialSimulatorCard />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
