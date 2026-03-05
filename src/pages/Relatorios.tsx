import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

// Report components
import { AnaliseOrcamentoContent } from "@/components/reports/AnaliseOrcamentoContent";
import { DREContent } from "@/components/reports/DREContent";
import { DemonstrativoContent } from "@/components/reports/DemonstrativoContent";
import { FluxoCaixaContent } from "@/components/reports/FluxoCaixaContent";
import { MovimentacoesReportContent } from "@/components/reports/MovimentacoesReportContent";
import { FinancialTypeReportContent } from "@/components/reports/FinancialTypeReportContent";
import { CategoryAnalysisContent } from "@/components/reports/CategoryAnalysisContent";
import { ReportsHub } from "@/components/reports/ReportsHub";

const TITLE_MAP: Record<string, string> = {
  movimentacoes: "Movimentações",
  fluxo: "Fluxo de Caixa",
  dre: "DRE",
  analise: "Análise de Orçamento",
  demonstrativo: "Demonstrativo Financeiro",
  "tipo-financeiro": "Tipo Financeiro",
  categorias: "Análise de Categorias",
};

export default function Relatorios() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");

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

  const pageTitle = tab ? (TITLE_MAP[tab] || "Relatórios") : "Relatórios";

  // On mobile with no tab selected, show the reports hub
  const showHub = !tab && isMobile;

  return (
    <AppLayout title={pageTitle}>
      <div className="space-y-4">
        {showHub && <ReportsHub />}
        {tab === "movimentacoes" && <MovimentacoesReportContent />}
        {tab === "analise" && <AnaliseOrcamentoContent />}
        {tab === "dre" && <DREContent />}
        {tab === "demonstrativo" && <DemonstrativoContent />}
        {tab === "fluxo" && <FluxoCaixaContent />}
        {tab === "tipo-financeiro" && <FinancialTypeReportContent />}
        {tab === "categorias" && <CategoryAnalysisContent />}
        {/* Desktop fallback: if no tab and not mobile, show movimentacoes */}
        {!tab && !isMobile && <MovimentacoesReportContent />}
      </div>
    </AppLayout>
  );
}
