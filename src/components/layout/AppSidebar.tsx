import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowUpDown,
  Wallet,
  PieChart,
  LogOut,
  TrendingUp,
  TrendingDown,
  Calendar,
  FileText,
  FolderKanban,
  BarChart3,
  Tags,
  Shield,
  Upload,
  Building2,
  CircleDollarSign,
  AlertCircle,
  Scale,
  Brain,
  Shuffle,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { usePendingTransactionsCount } from "@/hooks/usePendingTransactionsCount";

const mainNavItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Extrato",
    url: "/extrato",
    icon: ArrowUpDown,
  },
  {
    title: "Transações",
    url: "/transacoes",
    icon: Shuffle,
  },
  {
    title: "Receitas",
    url: "/receitas",
    icon: TrendingUp,
  },
  {
    title: "Despesas",
    url: "/despesas",
    icon: TrendingDown,
  },
];

const financialNavItems = [
  {
    title: "Contas Bancárias",
    url: "/contas",
    icon: Building2,
  },
  {
    title: "Categorias",
    url: "/categorias",
    icon: Tags,
  },
  {
    title: "Centros de Custo",
    url: "/centros-custo",
    icon: FolderKanban,
  },
  {
    title: "Regras Conciliação",
    url: "/regras-conciliacao",
    icon: Scale,
  },
  {
    title: "Importar Extratos",
    url: "/importacoes",
    icon: Upload,
  },
];

const reportsNavItems = [
  {
    title: "Análise Orçamento",
    url: "/analise-orcamento",
    icon: BarChart3,
  },
  {
    title: "Relatórios",
    url: "/relatorios",
    icon: FileText,
  },
  {
    title: "DRE",
    url: "/dre",
    icon: PieChart,
  },
  {
    title: "Demonst. Financeiro",
    url: "/demonstrativo-financeiro",
    icon: FileText,
  },
  {
    title: "Fluxo de Caixa",
    url: "/fluxo-caixa",
    icon: CircleDollarSign,
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: pendingCount } = usePendingTransactionsCount();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      console.error("Error during logout:", error);
      // Navigate anyway
      navigate("/auth");
    }
  };

  const isActive = (path: string) => location.pathname === path;

  const renderNavItems = (items: typeof mainNavItems, showBadgeFor?: string) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            isActive={isActive(item.url)}
            tooltip={collapsed ? item.title : undefined}
          >
            <NavLink
              to={item.url}
              end={item.url === "/"}
              className={`flex items-center transition-colors text-sm md:text-base py-2 ${
                collapsed ? "justify-center px-0" : "gap-2 md:gap-3"
              }`}
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className="whitespace-nowrap flex-1">{item.title}</span>
              )}
              {!collapsed && showBadgeFor === item.url && pendingCount && pendingCount > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1.5 font-semibold">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </Badge>
              )}
              {collapsed && showBadgeFor === item.url && pendingCount && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  // Custom planning items with badge
  const planningNavItems = [
    {
      title: "Orçamentos",
      url: "/orcamentos",
      icon: Wallet,
    },
    {
      title: "Pendências",
      url: "/pendencias",
      icon: AlertCircle,
      hasBadge: true,
    },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r-0 transition-all duration-300">
      <SidebarHeader className="p-3 md:p-4">
        <div className="flex items-center gap-2 md:gap-3">
          <img 
            src="/ibbra-logo.jpeg" 
            alt="Ibbra" 
            className="h-8 md:h-10 w-auto rounded-lg object-contain shrink-0"
          />
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-base md:text-lg font-bold text-sidebar-foreground">
                Ibbra
              </span>
              <span className="text-xs text-sidebar-muted">
                Gestão Financeira
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1.5 md:px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] md:text-xs uppercase tracking-wider">
            {!collapsed && "Principal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNavItems(mainNavItems)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-1.5 md:my-2 bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] md:text-xs uppercase tracking-wider">
            {!collapsed && "Financeiro"}
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNavItems(financialNavItems)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-1.5 md:my-2 bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] md:text-xs uppercase tracking-wider">
            {!collapsed && "Planejamento"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {planningNavItems.map((item) => (
                <SidebarMenuItem key={item.title} className="relative">
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      className={`flex items-center transition-colors text-sm md:text-base py-2 ${
                        collapsed ? "justify-center px-0" : "gap-2 md:gap-3"
                      }`}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className={`h-5 w-5 shrink-0 ${item.hasBadge && pendingCount && pendingCount > 0 ? "text-warning" : ""}`} />
                      {!collapsed && (
                        <span className="whitespace-nowrap flex-1">{item.title}</span>
                      )}
                      {!collapsed && item.hasBadge && pendingCount !== undefined && pendingCount > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1.5 font-semibold animate-pulse">
                          {pendingCount > 99 ? "99+" : pendingCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                  {collapsed && item.hasBadge && pendingCount !== undefined && pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {pendingCount > 9 ? "+" : pendingCount}
                    </span>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-1.5 md:my-2 bg-sidebar-border" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] md:text-xs uppercase tracking-wider">
            {!collapsed && "Relatórios"}
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNavItems(reportsNavItems)}</SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            <SidebarSeparator className="my-1.5 md:my-2 bg-sidebar-border" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-muted text-[10px] md:text-xs uppercase tracking-wider">
                {!collapsed && "Administração"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/admin")}
                      tooltip={collapsed ? "Gerenciar Acessos" : undefined}
                    >
                      <NavLink
                        to="/admin"
                        className={`flex items-center transition-colors text-sm md:text-base py-2 ${
                          collapsed ? "justify-center px-0" : "gap-2 md:gap-3"
                        }`}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <Shield className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="whitespace-nowrap">Gerenciar Acessos</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/padroes-aprendidos")}
                      tooltip={collapsed ? "Padrões Aprendidos" : undefined}
                    >
                      <NavLink
                        to="/padroes-aprendidos"
                        className={`flex items-center transition-colors text-sm md:text-base py-2 ${
                          collapsed ? "justify-center px-0" : "gap-2 md:gap-3"
                        }`}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <Brain className="h-5 w-5 shrink-0" />
                        {!collapsed && <span className="whitespace-nowrap">Padrões Aprendidos</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-1.5 md:p-2">
        <SidebarSeparator className="mb-1.5 md:mb-2 bg-sidebar-border" />
        
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className={`text-destructive hover:bg-destructive/10 hover:text-destructive text-sm md:text-base py-2 ${
                collapsed ? "justify-center px-0" : ""
              }`}
              tooltip={collapsed ? "Sair" : undefined}
              onClick={handleSignOut}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
