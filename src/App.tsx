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
import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
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

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
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
                    <Route path="/" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/extrato" element={<Extrato />} />
                    <Route path="/transacoes" element={<Transacoes />} />
                    <Route path="/receitas" element={<Receitas />} />
                    <Route path="/despesas" element={<Despesas />} />
                    <Route path="/movimentacoes" element={<Movimentacoes />} />
                    <Route path="/cadastros" element={<Cadastros />} />
                    <Route path="/contas" element={<Contas />} />
                    <Route path="/categorias" element={<Categorias />} />
                    <Route path="/centros-custo" element={<CentrosCusto />} />
                    <Route path="/regras-conciliacao" element={<RegrasConciliacao />} />
                    <Route path="/orcamentos" element={<Orcamentos />} />
                    <Route path="/pendencias" element={<Pendencias />} />
                    <Route path="/analise-orcamento" element={<AnaliseOrcamento />} />
                    <Route path="/relatorios" element={<Relatorios />} />
                    <Route path="/dre" element={<RelatorioDRE />} />
                    <Route path="/demonstrativo-financeiro" element={<DemonstrativoFinanceiro />} />
                    <Route path="/fluxo-caixa" element={<RelatorioFluxoCaixa />} />
                    <Route path="/importacoes" element={<Importacoes />} />
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/padroes-aprendidos" element={<PadroesAprendidos />} />
                    <Route path="/documentacao" element={<Documentacao />} />
                    <Route path="/open-finance" element={<OpenFinance />} />
                    <Route path="/callback-klavi" element={<CallbackKlavi />} />
                    <Route path="/cartoes" element={<CartoesCredito />} />
                    <Route path="/cartao/:accountId" element={<CartaoCredito />} />
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
          </ValuesVisibilityProvider>
        </BaseFilterProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
