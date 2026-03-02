import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BaseFilterProvider } from "@/contexts/BaseFilterContext";
import { ValuesVisibilityProvider } from "@/contexts/ValuesVisibilityContext";
import { UpgradeModalProvider } from "@/contexts/UpgradeModalContext";
import { ContextComposer } from "@/contexts/ContextComposer";
import { OnboardingGuard } from "@/components/auth/OnboardingGuard";
import { NavigationEventListener } from "@/components/layout/NavigationEventListener";
import { UpgradeModal } from "@/components/subscription/UpgradeModal";
import { Suspense, lazy, Component, ErrorInfo, ReactNode } from "react";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Sentry } from "@/lib/sentry";


// Critical pages - eagerly loaded
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Onboarding from "./pages/Onboarding";

// Lazy-loaded pages
const Admin = lazy(() => import("./pages/Admin"));
const Transacoes = lazy(() => import("./pages/Transacoes"));
const Receitas = lazy(() => import("./pages/Receitas"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const Pendencias = lazy(() => import("./pages/Pendencias"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const RelatorioDRE = lazy(() => import("./pages/RelatorioDRE"));
const RelatorioFluxoCaixa = lazy(() => import("./pages/RelatorioFluxoCaixa"));
const DemonstrativoFinanceiro = lazy(() => import("./pages/DemonstrativoFinanceiro"));
const Contas = lazy(() => import("./pages/Contas"));
const CentrosCusto = lazy(() => import("./pages/CentrosCusto"));
const AnaliseOrcamento = lazy(() => import("./pages/AnaliseOrcamento"));
const Categorias = lazy(() => import("./pages/Categorias"));
const Importacoes = lazy(() => import("./pages/Importacoes"));
const Perfil = lazy(() => import("./pages/Perfil"));
const RegrasConciliacao = lazy(() => import("./pages/RegrasConciliacao"));
const PadroesAprendidos = lazy(() => import("./pages/PadroesAprendidos"));
const Documentacao = lazy(() => import("./pages/Documentacao"));
const Extrato = lazy(() => import("./pages/Extrato"));
const Movimentacoes = lazy(() => import("./pages/Movimentacoes"));
const Cadastros = lazy(() => import("./pages/Cadastros"));
const OpenFinance = lazy(() => import("./pages/OpenFinance"));
const CallbackKlavi = lazy(() => import("./pages/CallbackKlavi"));
const CartaoCredito = lazy(() => import("./pages/CartaoCredito"));
const CartoesCredito = lazy(() => import("./pages/CartoesCredito"));
const OpenFinanceMonitor = lazy(() => import("./pages/OpenFinanceMonitor"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const Lgpd = lazy(() => import("./pages/Lgpd"));
const ConsentReaccept = lazy(() => import("./pages/ConsentReaccept"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
      onError: (error: any) => {
        console.error("[Mutation Error]", error);
      },
    },
  },
});

class GlobalErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[GlobalErrorBoundary]", error, errorInfo);
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      // Don't show error boundary on auth page - let it reload naturally
      const isAuthPage = typeof window !== 'undefined' && window.location.pathname === '/auth';
      if (isAuthPage) {
        setTimeout(() => { this.setState({ hasError: false, error: null }); }, 100);
        return this.props.children;
      }
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold text-foreground">Algo deu errado</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <GlobalErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <ContextComposer providers={[
      ThemeProvider,
      AuthProvider,
      BaseFilterProvider,
      ValuesVisibilityProvider,
      UpgradeModalProvider,
    ]}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        
        <UpgradeModal />
        <BrowserRouter>
          <NavigationEventListener />
          <Suspense fallback={<PageLoader />}>
            <OnboardingGuard>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/transacoes" element={<Transacoes />} />
                <Route path="/receitas" element={<Receitas />} />
                <Route path="/despesas" element={<Despesas />} />
                <Route path="/orcamentos" element={<Orcamentos />} />
                <Route path="/pendencias" element={<Pendencias />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/relatorio-dre" element={<RelatorioDRE />} />
                <Route path="/relatorio-fluxo-caixa" element={<RelatorioFluxoCaixa />} />
                <Route path="/demonstrativo-financeiro" element={<DemonstrativoFinanceiro />} />
                <Route path="/contas" element={<Contas />} />
                <Route path="/centros-custo" element={<CentrosCusto />} />
                <Route path="/analise-orcamento" element={<AnaliseOrcamento />} />
                <Route path="/categorias" element={<Categorias />} />
                <Route path="/importacoes" element={<Importacoes />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/regras-conciliacao" element={<RegrasConciliacao />} />
                <Route path="/padroes-aprendidos" element={<PadroesAprendidos />} />
                <Route path="/documentacao" element={<Documentacao />} />
                <Route path="/extrato" element={<Extrato />} />
                <Route path="/movimentacoes" element={<Movimentacoes />} />
                <Route path="/cadastros" element={<Cadastros />} />
                <Route path="/open-finance" element={<OpenFinance />} />
                <Route path="/callback-klavi" element={<CallbackKlavi />} />
                <Route path="/cartao-credito" element={<CartaoCredito />} />
                <Route path="/cartao/:accountId" element={<CartaoCredito />} />
                <Route path="/cartoes-credito" element={<CartoesCredito />} />
                <Route path="/cartoes" element={<CartoesCredito />} />
                <Route path="/open-finance-monitor" element={<OpenFinanceMonitor />} />
                <Route path="/termos-de-uso" element={<TermosDeUso />} />
                <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
                <Route path="/lgpd" element={<Lgpd />} />
                <Route path="/consent-reaccept" element={<ConsentReaccept />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </OnboardingGuard>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ContextComposer>
  </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
