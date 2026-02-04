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
  User,
  ChevronRight,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const { signOut, user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: pendingCount } = usePendingTransactionsCount();

  // Fetch user profile and role
  const { data: userProfile } = useQuery({
    queryKey: ["sidebar-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: userRole } = useQuery({
    queryKey: ["sidebar-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (error) return null;
      return data?.role;
    },
    enabled: !!user?.id,
  });

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

  const getRoleLabel = (role: string | null | undefined): string => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      supervisor: "Supervisor",
      kam: "KAM",
      fa: "FA",
      projetista: "Projetista",
      cliente: "Cliente",
      user: "Usuário",
    };
    return role ? labels[role] || "Usuário" : "Usuário";
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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
              className={`flex items-center transition-all duration-200 text-sm py-2.5 rounded-lg ${
                collapsed ? "justify-center px-0" : "gap-3 px-3"
              } ${isActive(item.url) ? "bg-sidebar-accent/80 text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`}
              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
            >
              <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive(item.url) ? "text-sidebar-primary" : ""}`} />
              {!collapsed && (
                <span className="whitespace-nowrap flex-1 tracking-tight">{item.title}</span>
              )}
              {!collapsed && showBadgeFor === item.url && pendingCount && pendingCount > 0 && (
                <Badge className="h-5 min-w-5 text-[10px] px-1.5 font-semibold bg-accent text-accent-foreground border-0">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </Badge>
              )}
              {collapsed && showBadgeFor === item.url && pendingCount && pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-accent text-accent-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                  {pendingCount > 9 ? "9+" : pendingCount}
                </span>
              )}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

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
    <Sidebar collapsible="icon" className="border-r-0 transition-all duration-300 sidebar-premium">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img 
              src="/ibbra-logo.jpeg" 
              alt="Ibbra" 
              className="h-10 w-10 rounded-xl object-cover shrink-0 shadow-md"
            />
            {!collapsed && (
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-success rounded-full border-2 border-sidebar-background" />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
                Ibbra
              </span>
              <span className="text-[10px] text-sidebar-muted uppercase tracking-widest">
                Financial
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest font-medium px-3 mb-1">
            {!collapsed && "Principal"}
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNavItems(mainNavItems)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-3 bg-sidebar-border/50" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest font-medium px-3 mb-1">
            {!collapsed && "Financeiro"}
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNavItems(financialNavItems)}</SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-3 bg-sidebar-border/50" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest font-medium px-3 mb-1">
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
                      className={`flex items-center transition-all duration-200 text-sm py-2.5 rounded-lg ${
                        collapsed ? "justify-center px-0" : "gap-3 px-3"
                      } ${isActive(item.url) ? "bg-sidebar-accent/80 text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className={`h-[18px] w-[18px] shrink-0 ${item.hasBadge && pendingCount && pendingCount > 0 ? "text-accent" : ""} ${isActive(item.url) ? "text-sidebar-primary" : ""}`} />
                      {!collapsed && (
                        <span className="whitespace-nowrap flex-1 tracking-tight">{item.title}</span>
                      )}
                      {!collapsed && item.hasBadge && pendingCount !== undefined && pendingCount > 0 && (
                        <Badge className="h-5 min-w-5 text-[10px] px-1.5 font-semibold bg-accent text-accent-foreground border-0 animate-pulse">
                          {pendingCount > 99 ? "99+" : pendingCount}
                        </Badge>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                  {collapsed && item.hasBadge && pendingCount !== undefined && pendingCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-accent text-accent-foreground text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {pendingCount > 9 ? "+" : pendingCount}
                    </span>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-3 bg-sidebar-border/50" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest font-medium px-3 mb-1">
            {!collapsed && "Relatórios"}
          </SidebarGroupLabel>
          <SidebarGroupContent>{renderNavItems(reportsNavItems)}</SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <>
            <SidebarSeparator className="my-3 bg-sidebar-border/50" />
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-muted text-[10px] uppercase tracking-widest font-medium px-3 mb-1">
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
                        className={`flex items-center transition-all duration-200 text-sm py-2.5 rounded-lg ${
                          collapsed ? "justify-center px-0" : "gap-3 px-3"
                        } ${isActive("/admin") ? "bg-sidebar-accent/80 text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <Shield className={`h-[18px] w-[18px] shrink-0 ${isActive("/admin") ? "text-sidebar-primary" : ""}`} />
                        {!collapsed && <span className="whitespace-nowrap tracking-tight">Gerenciar Acessos</span>}
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
                        className={`flex items-center transition-all duration-200 text-sm py-2.5 rounded-lg ${
                          collapsed ? "justify-center px-0" : "gap-3 px-3"
                        } ${isActive("/padroes-aprendidos") ? "bg-sidebar-accent/80 text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <Brain className={`h-[18px] w-[18px] shrink-0 ${isActive("/padroes-aprendidos") ? "text-sidebar-primary" : ""}`} />
                        {!collapsed && <span className="whitespace-nowrap tracking-tight">Padrões Aprendidos</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-2 pt-0">
        <SidebarSeparator className="mb-3 bg-sidebar-border/50" />
        
        {/* User Profile Section */}
        {!collapsed && (
          <div 
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/30 mb-2 cursor-pointer hover:bg-sidebar-accent/50 transition-colors"
            onClick={() => navigate("/perfil")}
          >
            <Avatar className="h-9 w-9 border-2 border-sidebar-border">
              <AvatarImage src={userProfile?.avatar_url || undefined} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                {getInitials(userProfile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {userProfile?.full_name || "Usuário"}
              </p>
              <p className="text-[10px] text-sidebar-primary font-medium uppercase tracking-wider">
                {getRoleLabel(userRole)}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-sidebar-muted" />
          </div>
        )}

        {collapsed && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Meu Perfil"
                className="justify-center"
                onClick={() => navigate("/perfil")}
              >
                <Avatar className="h-8 w-8 border border-sidebar-border">
                  <AvatarImage src={userProfile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                    {getInitials(userProfile?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className={`text-destructive/80 hover:bg-destructive/10 hover:text-destructive text-sm py-2.5 rounded-lg transition-all duration-200 ${
                collapsed ? "justify-center px-0" : "px-3"
              }`}
              tooltip={collapsed ? "Sair" : undefined}
              onClick={handleSignOut}
            >
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="tracking-tight">Sair do Sistema</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
