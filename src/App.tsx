import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BaseFilterProvider } from "@/contexts/BaseFilterContext";
import { ValuesVisibilityProvider } from "@/contexts/ValuesVisibilityContext";
import { OnboardingGuard } from "@/components/auth/OnboardingGuard";
import { Suspense, lazy, Component, ErrorInfo, ReactNode } from "react";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { IOSInstallPrompt } from "@/components/pwa/IOSInstallPrompt";

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
  }

  render() {
    if (this.state.hasError) {
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
    <ThemeProvider>
      <AuthProvider>
        <BaseFilterProvider>
          <ValuesVisibilityProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <IOSInstallPrompt />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <OnboardingGuard>
                  <Routes>
...
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </OnboardingGuard>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
          </ValuesVisibilityProvider>
        </BaseFilterProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
