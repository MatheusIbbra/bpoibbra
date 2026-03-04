import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, Receipt, Upload, AlertCircle, ChevronRight, ChevronDown,
  Wallet, BarChart3, CircleDollarSign, PieChart, Layers, Tags,
  Lightbulb, Radio, Building2, FolderKanban, Scale, CreditCard,
  Shield, Brain, FileText, Sparkles, Crown, Zap, Smartphone, LogOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { usePendingTransactionsCount } from "@/hooks/usePendingTransactionsCount";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { PWAInstallModal } from "@/components/pwa/PWAInstallModal";
import { useEffect } from "react";

const reportSubItems = [
  { title: "Movimentações", tab: "movimentacoes", icon: Receipt },
  { title: "Fluxo de Caixa", tab: "fluxo", icon: CircleDollarSign },
  { title: "DRE", tab: "dre", icon: PieChart },
  { title: "Orçamento", tab: "analise", icon: BarChart3 },
  { title: "Demonstrativo", tab: "demonstrativo", icon: FileText },
  { title: "Tipo Financeiro", tab: "tipo-financeiro", icon: Layers },
  { title: "Análise Categorias", tab: "categorias", icon: Tags },
  { title: "Análises Estratégicas", tab: "estrategico", icon: Lightbulb },
];

const cadastrosSubItems = [
  { title: "Contas", url: "/contas", icon: Building2 },
  { title: "Categorias", url: "/categorias", icon: Tags },
  { title: "Centros de Custo", url: "/centros-custo", icon: FolderKanban },
  { title: "Open Finance", url: "/open-finance", icon: Radio },
  { title: "Regras", url: "/regras-conciliacao", icon: Scale, adminOnly: true },
];

const navItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Orçamentos", url: "/orcamentos", icon: Wallet },
  { title: "Cartões de Crédito", url: "/cartoes", icon: CreditCard },
  { title: "Importar Extratos", url: "/importacoes", icon: Upload },
];

interface MainSidebarProps {
  open: boolean;
}

export function MainSidebar({ open }: MainSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: pendingCount } = usePendingTransactionsCount();
  const { currentPlan } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const cadastrosPages = ["/contas", "/categorias", "/centros-custo", "/open-finance", "/regras-conciliacao"];

  const [reportsOpen, setReportsOpen] = useState(location.pathname === "/relatorios");
  const [cadastrosOpen, setCadastrosOpen] = useState(cadastrosPages.includes(location.pathname));

  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);
  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = ("standalone" in window.navigator && (window.navigator as Record<string, unknown>).standalone) ||
      window.matchMedia("(display-mode: standalone)").matches;
    setShowPwaPrompt(isIOS && !isStandalone);
  }, []);

  const isActive = (path: string) => location.pathname === path;
  const isReportActive = location.pathname === "/relatorios";
  const isCadastrosActive = cadastrosPages.includes(location.pathname);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch {
      navigate("/auth");
    }
  };

  return (
    <>
      <aside
        className={`fixed left-16 top-0 z-40 h-screen border-r border-sidebar-border/20 transition-all duration-300 ease-in-out ${
          open ? "w-60 translate-x-0" : "w-0 -translate-x-60"
        } overflow-hidden`}
        style={{
          background: "linear-gradient(180deg, hsl(213 80% 13%) 0%, hsl(213 72% 8%) 100%)",
        }}
      >
        <div className="flex h-full w-60 flex-col">
          {/* Plan indicator */}
          <div className="px-3 pt-5 pb-2">
            <button
              onClick={() => openUpgradeModal("general")}
              className="group w-full px-3 py-2.5 rounded-xl bg-[hsl(213,55%,20%)/0.4] hover:bg-[hsl(213,55%,20%)/0.6] border border-[hsl(213,45%,22%)/0.2] hover:border-[hsl(210,100%,50%)/0.3] transition-all duration-300 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                {currentPlan?.slug?.toLowerCase() === "pro" ? (
                  <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                ) : currentPlan?.slug?.toLowerCase() === "plus" ? (
                  <Zap className="h-3.5 w-3.5 text-[hsl(210,100%,50%)] shrink-0" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-[hsl(210,100%,50%)] shrink-0" />
                )}
                <span className="text-[11px] font-semibold text-[hsl(214,30%,88%)] tracking-wide">
                  {currentPlan?.name || "Starter"}
                </span>
                <ChevronRight className="h-3 w-3 text-[hsl(215,18%,58%)] ml-auto group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          </div>

          <ScrollArea className="flex-1 px-3 py-2">
            {/* Main nav */}
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <button
                    key={item.url}
                    onClick={() => navigate(item.url)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200 ${
                      active
                        ? "text-white font-semibold border-l-[3px] border-l-[hsl(210,100%,50%)] pl-[9px]"
                        : "text-[hsl(215,18%,58%)] hover:text-[hsl(214,30%,88%)] hover:bg-[hsl(213,55%,20%)/0.25]"
                    }`}
                  >
                    <item.icon className={`h-[17px] w-[17px] shrink-0 ${active ? "text-[hsl(210,100%,50%)]" : ""}`} strokeWidth={active ? 2 : 1.5} />
                    <span className="flex-1 text-left">{item.title}</span>
                    {item.url === "/pendencias" && pendingCount > 0 && (
                      <Badge variant="destructive" className="ml-auto text-[10px] h-5 min-w-5 flex items-center justify-center">
                        {pendingCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Reports */}
            <div className="mt-4">
              <button
                onClick={() => setReportsOpen(!reportsOpen)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200 ${
                  isReportActive
                    ? "text-white font-semibold border-l-[3px] border-l-[hsl(210,100%,50%)] pl-[9px]"
                    : "text-[hsl(215,18%,58%)] hover:text-[hsl(214,30%,88%)] hover:bg-[hsl(213,55%,20%)/0.25]"
                }`}
              >
                <BarChart3 className={`h-[17px] w-[17px] shrink-0 ${isReportActive ? "text-[hsl(210,100%,50%)]" : ""}`} />
                <span className="flex-1 text-left">Relatórios</span>
                {reportsOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              </button>
              {reportsOpen && (
                <div className="ml-5 mt-1 space-y-0.5 border-l border-[hsl(213,45%,22%)/0.3] pl-3">
                  {reportSubItems.map((sub) => {
                    const searchParams = new URLSearchParams(location.search);
                    const currentTab = searchParams.get("tab");
                    const isSubActive = isReportActive && currentTab === sub.tab;
                    return (
                      <button
                        key={sub.tab}
                        onClick={() => navigate(`/relatorios?tab=${sub.tab}`)}
                        className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-all duration-150 ${
                          isSubActive
                            ? "bg-[hsl(213,55%,20%)/0.6] text-[hsl(214,30%,88%)] font-medium"
                            : "text-[hsl(215,18%,58%)] hover:text-[hsl(214,30%,88%)] hover:bg-[hsl(213,55%,20%)/0.3]"
                        }`}
                      >
                        <sub.icon className="h-3.5 w-3.5 shrink-0" />
                        <span>{sub.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cadastros */}
            <div className="mt-1">
              <button
                onClick={() => setCadastrosOpen(!cadastrosOpen)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200 ${
                  isCadastrosActive
                    ? "text-white font-semibold border-l-[3px] border-l-[hsl(210,100%,50%)] pl-[9px]"
                    : "text-[hsl(215,18%,58%)] hover:text-[hsl(214,30%,88%)] hover:bg-[hsl(213,55%,20%)/0.25]"
                }`}
              >
                <Building2 className={`h-[17px] w-[17px] shrink-0 ${isCadastrosActive ? "text-[hsl(210,100%,50%)]" : ""}`} />
                <span className="flex-1 text-left">Cadastros</span>
                {cadastrosOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
              </button>
              {cadastrosOpen && (
                <div className="ml-5 mt-1 space-y-0.5 border-l border-[hsl(213,45%,22%)/0.3] pl-3">
                  {cadastrosSubItems
                    .filter((sub) => !sub.adminOnly || isAdmin)
                    .map((sub) => {
                      const isSubActive = location.pathname === sub.url;
                      return (
                        <button
                          key={sub.url}
                          onClick={() => navigate(sub.url)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-all duration-150 ${
                            isSubActive
                              ? "bg-[hsl(213,55%,20%)/0.6] text-[hsl(214,30%,88%)] font-medium"
                              : "text-[hsl(215,18%,58%)] hover:text-[hsl(214,30%,88%)] hover:bg-[hsl(213,55%,20%)/0.3]"
                          }`}
                        >
                          <sub.icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{sub.title}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Admin section */}
            {isAdmin && (
              <>
                <div className="my-3 border-t border-[hsl(213,45%,22%)/0.4]" />
                <nav className="space-y-0.5">
                  {[
                    { title: "Pendências", url: "/pendencias", icon: AlertCircle },
                    { title: "Gerenciar Acessos", url: "/admin", icon: Shield },
                    { title: "Padrões Aprendidos", url: "/padroes-aprendidos", icon: Brain },
                    { title: "OF Monitor", url: "/open-finance-monitor", icon: Radio },
                  ].map((item) => {
                    const active = isActive(item.url);
                    return (
                      <button
                        key={item.url}
                        onClick={() => navigate(item.url)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200 ${
                          active
                            ? "text-white font-semibold border-l-[3px] border-l-[hsl(210,100%,50%)] pl-[9px]"
                            : "text-[hsl(215,18%,58%)] hover:text-[hsl(214,30%,88%)] hover:bg-[hsl(213,55%,20%)/0.25]"
                        }`}
                      >
                        <item.icon className={`h-[17px] w-[17px] shrink-0 ${active ? "text-[hsl(210,100%,50%)]" : ""}`} strokeWidth={active ? 2 : 1.5} />
                        <span className="flex-1 text-left">{item.title}</span>
                        {item.url === "/pendencias" && pendingCount > 0 && (
                          <Badge variant="destructive" className="ml-auto text-[10px] h-5 min-w-5 flex items-center justify-center">
                            {pendingCount}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="px-3 pb-4 pt-2 border-t border-[hsl(213,45%,22%)/0.4]">
            {showPwaPrompt && (
              <button
                onClick={() => setShowPwaModal(true)}
                className="w-full mb-2 px-3 py-2.5 rounded-lg bg-[hsl(213,55%,20%)/0.2] border border-[hsl(213,45%,22%)/0.2] text-left hover:bg-[hsl(213,55%,20%)/0.3] transition-colors"
              >
                <p className="text-[11px] text-[hsl(214,30%,88%)] font-medium flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-[hsl(210,100%,50%)] shrink-0" />
                  Instale o APP
                </p>
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
            >
              <LogOut className="h-[17px] w-[17px] shrink-0" />
              <span>Sair do Sistema</span>
            </button>
          </div>
        </div>
      </aside>
      <PWAInstallModal open={showPwaModal} onClose={() => setShowPwaModal(false)} />
    </>
  );
}
