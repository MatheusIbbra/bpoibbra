import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BaseFilterProvider } from "@/contexts/BaseFilterContext";
import { ValuesVisibilityProvider } from "@/contexts/ValuesVisibilityContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Transacoes from "./pages/Transacoes";
import Receitas from "./pages/Receitas";
import Despesas from "./pages/Despesas";
import Orcamentos from "./pages/Orcamentos";
import Pendencias from "./pages/Pendencias";
import Relatorios from "./pages/Relatorios";
import RelatorioDRE from "./pages/RelatorioDRE";
import RelatorioFluxoCaixa from "./pages/RelatorioFluxoCaixa";
import DemonstrativoFinanceiro from "./pages/DemonstrativoFinanceiro";
import Contas from "./pages/Contas";
import CentrosCusto from "./pages/CentrosCusto";
import AnaliseOrcamento from "./pages/AnaliseOrcamento";
import Categorias from "./pages/Categorias";
import Importacoes from "./pages/Importacoes";
import Perfil from "./pages/Perfil";
import NotFound from "./pages/NotFound";
import RegrasConciliacao from "./pages/RegrasConciliacao";
import PadroesAprendidos from "./pages/PadroesAprendidos";
import Documentacao from "./pages/Documentacao";
import Extrato from "./pages/Extrato";
import Movimentacoes from "./pages/Movimentacoes";
import Cadastros from "./pages/Cadastros";
import OpenFinance from "./pages/OpenFinance";
import CallbackKlavi from "./pages/CallbackKlavi";
import CartaoCredito from "./pages/CartaoCredito";
import CartoesCredito from "./pages/CartoesCredito";
import OpenFinanceMonitor from "./pages/OpenFinanceMonitor";
import VisaoPatrimonial from "./pages/VisaoPatrimonial";
import Consolidacao from "./pages/Consolidacao";
import Indicadores from "./pages/Indicadores";
import Projecao from "./pages/Projecao";
import Simulacoes from "./pages/Simulacoes";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <BaseFilterProvider>
          <ValuesVisibilityProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
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
                <Route path="/visao-patrimonial" element={<VisaoPatrimonial />} />
                <Route path="/consolidacao" element={<Consolidacao />} />
                <Route path="/indicadores" element={<Indicadores />} />
                <Route path="/projecao" element={<Projecao />} />
                <Route path="/simulacoes" element={<Simulacoes />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
          </ValuesVisibilityProvider>
        </BaseFilterProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
