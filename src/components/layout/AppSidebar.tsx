import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Upload, AlertCircle, ChevronRight, ChevronDown, Home, Receipt, Settings2, Wallet, FileText, Shield, Brain, CreditCard, BarChart3, CircleDollarSign, PieChart, Layers, Tags, Lightbulb, Radio, Building2, FolderKanban, Scale, TrendingUp, Smartphone, Sparkles, Crown, Zap } from "lucide-react";
import { PWAInstallModal } from "@/components/pwa/PWAInstallModal";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarSeparator } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin, useCurrentUserRole } from "@/hooks/useUserRoles";
import { usePendingTransactionsCount } from "@/hooks/usePendingTransactionsCount";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import ibbraLogoWhite from "@/assets/ibbra-logo-white.png";
import ibbraLogoFullWhite from "@/assets/ibbra-logo-full-white.png";

// Prefetch helper — silently preloads a lazy-loaded route module on hover
const prefetch = (fn: () => Promise<unknown>) => { fn().catch(() => {}); };

const reportSubItems = [
  { title: "Movimentações", url: "/relatorios?tab=movimentacoes", tab: "movimentacoes", icon: Receipt },
  { title: "Fluxo de Caixa", url: "/relatorios?tab=fluxo", tab: "fluxo", icon: CircleDollarSign },
  { title: "DRE", url: "/relatorios?tab=dre", tab: "dre", icon: PieChart },
  { title: "Orçamento", url: "/relatorios?tab=analise", tab: "analise", icon: BarChart3 },
  { title: "Demonstrativo", url: "/relatorios?tab=demonstrativo", tab: "demonstrativo", icon: FileText },
  { title: "Tipo Financeiro", url: "/relatorios?tab=tipo-financeiro", tab: "tipo-financeiro", icon: Layers },
  { title: "Análise Categorias", url: "/relatorios?tab=categorias", tab: "categorias", icon: Tags },
  
];

const cadastrosSubItems = [
  { title: "Contas", url: "/contas", icon: Building2 },
  { title: "Categorias", url: "/categorias", icon: Tags },
  { title: "Centros de Custo", url: "/centros-custo", icon: FolderKanban },
  { title: "Open Finance", url: "/open-finance", icon: Radio },
  { title: "Regras", url: "/regras-conciliacao", icon: Scale, adminOnly: true },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: currentRole } = useCurrentUserRole();
  const isStaff = currentRole && currentRole !== "cliente";
  const { data: pendingCount } = usePendingTransactionsCount();
  const { currentPlan } = useSubscription();
  const { openUpgradeModal } = useUpgradeModal();
  const [reportsOpen, setReportsOpen] = useState(location.pathname === "/relatorios");
  const cadastrosPages = ["/contas", "/categorias", "/centros-custo", "/open-finance", "/regras-conciliacao"];
  const [cadastrosOpen, setCadastrosOpen] = useState(cadastrosPages.includes(location.pathname));

  // PWA install prompt detection
  const [showPwaPrompt, setShowPwaPrompt] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);
  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = ("standalone" in window.navigator && (window.navigator as any).standalone) ||
      window.matchMedia("(display-mode: standalone)").matches;
    setShowPwaPrompt(isIOS && !isStandalone);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error during logout:", error);
      navigate("/auth");
    }
  };

  const isActive = (path: string) => location.pathname === path;
  const isReportActive = location.pathname === "/relatorios";

  // Build nav items based on role — order: Dashboard, Orçamentos, Cartões, Importar, Relatórios, Cadastros
  const navItems = [
    { title: "Dashboard", url: "/", icon: Home, prefetchFn: () => import("../../pages/Index") },
    { title: "Orçamentos", url: "/orcamentos", icon: Wallet, prefetchFn: () => import("../../pages/Orcamentos") },
    { title: "Cartões de Crédito", url: "/cartoes", icon: CreditCard, prefetchFn: () => import("../../pages/CartoesCredito") },
    { title: "Importar Extratos", url: "/importacoes", icon: Upload, prefetchFn: () => import("../../pages/Importacoes") },
  ];

  // "Relatórios" and "Cadastros" are handled separately as submenus
  const isCadastrosActive = cadastrosPages.includes(location.pathname);

  const renderNavItem = (item: { title: string; url: string; icon: React.ElementType; prefetchFn?: () => Promise<unknown> }) => {
    const active = isActive(item.url);
    return (
    <SidebarMenuItem key={item.title} className="relative" onMouseEnter={item.prefetchFn ? () => prefetch(item.prefetchFn!) : undefined}>
      <SidebarMenuButton asChild isActive={active} tooltip={collapsed ? item.title : undefined}>
        <NavLink
          to={item.url}
          end={item.url === "/"}
          className={`flex items-center transition-all duration-200 py-2.5 rounded-lg ${collapsed ? "justify-center px-2" : "gap-3 px-3"} ${active ? "text-white" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/25"}`}
          activeClassName="text-white"
          style={active && !collapsed ? { borderLeft: "2px solid hsl(210 100% 50%)", paddingLeft: "10px" } : {}}
        >
          <item.icon
            className={`shrink-0 transition-all ${active ? "text-sidebar-primary" : "text-sidebar-muted"}`}
            style={{ width: "17px", height: "17px" }}
            strokeWidth={active ? 2 : 1.5}
          />
          {!collapsed && (
            <span className={`whitespace-nowrap flex-1 text-[13px] ${active ? "font-semibold" : "font-normal"}`}>
              {item.title}
            </span>
          )}
          {!collapsed && item.url === "/pendencias" && pendingCount > 0 && (
            <Badge variant="destructive" className="ml-auto text-[10px] h-5 min-w-5 flex items-center justify-center">
              {pendingCount}
            </Badge>
          )}
        </NavLink>
      </SidebarMenuButton>
      {collapsed && item.url === "/pendencias" && pendingCount > 0 && (
        <span className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1">
          {pendingCount}
        </span>
      )}
    </SidebarMenuItem>
  );
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0 transition-all duration-300 sidebar-premium">
      <SidebarHeader className="p-4 pb-2">
        <div className="gap-2 flex-col flex items-center justify-center py-4">
          <div className="relative">
            {collapsed ? (
              <img src={ibbraLogoWhite} alt="Ibbra" className="h-8 w-8 object-contain shrink-0 transition-all duration-300" />
            ) : (
              <img src={ibbraLogoFullWhite} alt="Ibbra" className="h-10 object-contain shrink-0 transition-all duration-300" />
            )}
          </div>
        </div>
        {/* Plan indicator — hidden for staff roles */}
        {!isStaff && !collapsed && (
          <button
            onClick={() => openUpgradeModal("general")}
            className="group mx-1 mb-1 px-3 py-2.5 rounded-xl bg-gradient-to-r from-sidebar-accent/40 to-sidebar-accent/20 hover:from-sidebar-accent/60 hover:to-sidebar-accent/30 border border-sidebar-border/20 hover:border-sidebar-primary/30 transition-all duration-300 text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {currentPlan?.slug?.toLowerCase() === 'pro' ? (
                <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              ) : currentPlan?.slug?.toLowerCase() === 'plus' ? (
                <Zap className="h-3.5 w-3.5 text-sidebar-primary shrink-0" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-sidebar-primary shrink-0" />
              )}
              <span className="text-[11px] font-semibold text-sidebar-foreground tracking-wide">
                {currentPlan?.name || "Starter"}
              </span>
              <ChevronRight className="h-3 w-3 text-sidebar-muted ml-auto group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[9px] text-sidebar-muted mt-1 ml-5.5">
              {currentPlan?.slug?.toLowerCase() === 'pro' ? 'Plano completo' : 'Ver planos disponíveis'}
            </p>
          </button>
        )}
        {!isStaff && collapsed && (
          <SidebarMenuButton
            onClick={() => openUpgradeModal("general")}
            tooltip={currentPlan?.name || "Starter"}
            className="mb-1 h-8 w-8 mx-auto rounded-lg bg-sidebar-accent/30 hover:bg-sidebar-accent/50 border border-sidebar-border/20 hover:border-sidebar-primary/30 flex items-center justify-center transition-all cursor-pointer"
          >
            {currentPlan?.slug?.toLowerCase() === 'pro' ? (
              <Crown className="h-3.5 w-3.5 text-amber-400" />
            ) : currentPlan?.slug?.toLowerCase() === 'plus' ? (
              <Zap className="h-3.5 w-3.5 text-sidebar-primary" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-sidebar-primary" />
            )}
          </SidebarMenuButton>
        )}
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarMenu>
          {navItems.map(renderNavItem)}

          {/* Reports with submenu */}
          <SidebarMenuItem>
            {collapsed ? (
              <SidebarMenuButton isActive={isReportActive} tooltip="Relatórios" onClick={() => { toggleSidebar(); setReportsOpen(true); }}>
                <BarChart3 className={`h-[18px] w-[18px] shrink-0 ${isReportActive ? "text-sidebar-primary" : ""}`} />
              </SidebarMenuButton>
            ) : (
              <>
                <button
                  onClick={() => setReportsOpen(!reportsOpen)}
                  className={`flex items-center w-full transition-all duration-200 text-sm py-3 rounded-xl gap-3 px-3 ${isReportActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`}
                >
                  <BarChart3 className={`h-[19px] w-[19px] shrink-0 ${isReportActive ? "text-sidebar-primary" : ""}`} />
                  <span className="whitespace-nowrap flex-1 text-[13.5px] text-left">Relatórios</span>
                  {reportsOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" />
                  )}
                </button>
                {reportsOpen && (
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border/30 pl-3">
                    {reportSubItems.map(sub => {
                      const searchParams = new URLSearchParams(location.search);
                      const currentTab = searchParams.get("tab");
                      const isSubActive = isReportActive && currentTab === sub.tab;
                      return (
                        <button
                          key={sub.tab}
                          onClick={() => navigate(`/relatorios?tab=${sub.tab}`)}
                          className={`flex items-center gap-2 w-full text-[12px] py-1.5 px-2 rounded-lg transition-all duration-150 ${isSubActive ? "bg-sidebar-accent/60 text-sidebar-accent-foreground font-medium" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/30"}`}
                        >
                          <sub.icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{sub.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </SidebarMenuItem>

          {/* Cadastros with submenu */}
          <SidebarMenuItem>
            {collapsed ? (
              <SidebarMenuButton isActive={isCadastrosActive} tooltip="Cadastros" onClick={() => { toggleSidebar(); setCadastrosOpen(true); }}>
                <Settings2 className={`h-[18px] w-[18px] shrink-0 ${isCadastrosActive ? "text-sidebar-primary" : ""}`} />
              </SidebarMenuButton>
            ) : (
              <>
                <button
                  onClick={() => setCadastrosOpen(!cadastrosOpen)}
                  className={`flex items-center w-full transition-all duration-200 text-sm py-3 rounded-xl gap-3 px-3 ${isCadastrosActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`}
                >
                  <Settings2 className={`h-[19px] w-[19px] shrink-0 ${isCadastrosActive ? "text-sidebar-primary" : ""}`} />
                  <span className="whitespace-nowrap flex-1 text-[13.5px] text-left">Cadastros</span>
                  {cadastrosOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sidebar-muted" />
                  )}
                </button>
                {cadastrosOpen && (
                  <div className="ml-5 mt-1 space-y-0.5 border-l border-sidebar-border/30 pl-3">
                    {cadastrosSubItems
                      .filter(sub => !sub.adminOnly || isAdmin)
                      .map(sub => {
                      const isSubActive = location.pathname === sub.url;
                      return (
                        <button
                          key={sub.url}
                          onClick={() => navigate(sub.url)}
                          className={`flex items-center gap-2 w-full text-[12px] py-1.5 px-2 rounded-lg transition-all duration-150 ${isSubActive ? "bg-sidebar-accent/60 text-sidebar-accent-foreground font-medium" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/30"}`}
                        >
                          <sub.icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{sub.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </SidebarMenuItem>
        </SidebarMenu>

        {isAdmin && <>
          <SidebarSeparator className="my-3 bg-sidebar-border/40" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip={collapsed ? "Gerenciar Acessos" : undefined}>
                <NavLink to="/admin" className={`flex items-center transition-all duration-200 text-sm py-2.5 rounded-xl ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${isActive("/admin") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                  <Shield className={`h-[18px] w-[18px] shrink-0 ${isActive("/admin") ? "text-sidebar-primary" : ""}`} />
                  {!collapsed && <span className="whitespace-nowrap text-[13px]">Gerenciar Acessos</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/padroes-aprendidos")} tooltip={collapsed ? "Padrões Aprendidos" : undefined}>
                <NavLink to="/padroes-aprendidos" className={`flex items-center transition-all duration-200 text-sm py-2.5 rounded-xl ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${isActive("/padroes-aprendidos") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                  <Brain className={`h-[18px] w-[18px] shrink-0 ${isActive("/padroes-aprendidos") ? "text-sidebar-primary" : ""}`} />
                  {!collapsed && <span className="whitespace-nowrap text-[13px]">Padrões Aprendidos</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={isActive("/open-finance-monitor")} tooltip={collapsed ? "Open Finance Monitor" : undefined}>
                <NavLink to="/open-finance-monitor" className={`flex items-center transition-all duration-200 text-sm py-2.5 rounded-xl ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${isActive("/open-finance-monitor") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                  <Radio className={`h-[18px] w-[18px] shrink-0 ${isActive("/open-finance-monitor") ? "text-sidebar-primary" : ""}`} />
                  {!collapsed && <span className="whitespace-nowrap text-[13px]">OF Monitor</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </>}
      </SidebarContent>

      <SidebarFooter className="p-3 pt-0">
        <SidebarSeparator className="mb-3 bg-sidebar-border/40" />
        
        {/* PWA Install Prompt - only on iOS Safari not in standalone */}
        {!collapsed && showPwaPrompt && (
          <button
            onClick={() => setShowPwaModal(true)}
            className="mx-1 mb-2 px-3 py-2.5 rounded-lg bg-sidebar-accent/20 border border-sidebar-border/20 text-left hover:bg-sidebar-accent/30 transition-colors w-full"
          >
            <p className="text-[11px] text-sidebar-foreground font-medium flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-sidebar-primary shrink-0" />
              Instale o APP no seu dispositivo
            </p>
            <p className="text-[10px] text-sidebar-muted mt-0.5">
              Toque para ver as instruções
            </p>
          </button>
        )}
        <PWAInstallModal open={showPwaModal} onClose={() => setShowPwaModal(false)} />

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className={`text-destructive/70 hover:bg-destructive/10 hover:text-destructive text-sm py-2.5 rounded-xl transition-all duration-200 ${collapsed ? "justify-center px-0" : "px-3"}`} tooltip={collapsed ? "Sair" : undefined} onClick={handleSignOut}>
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="text-[13px]">Sair do Sistema</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
