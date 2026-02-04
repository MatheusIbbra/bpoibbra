import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Upload, AlertCircle, User, ChevronRight, Home, Receipt, Settings2, Wallet, FileText, Shield, Brain } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, SidebarSeparator } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { usePendingTransactionsCount } from "@/hooks/usePendingTransactionsCount";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ibbraLogoWhite from "@/assets/ibbra-logo-white.png";
const navItems = [{
  title: "Home",
  url: "/",
  icon: Home
}, {
  title: "Importar Extratos",
  url: "/importacoes",
  icon: Upload
}, {
  title: "Orçamentos",
  url: "/orcamentos",
  icon: Wallet
}, {
  title: "Pendências",
  url: "/pendencias",
  icon: AlertCircle,
  hasBadge: true
}, {
  title: "Relatórios",
  url: "/relatorios",
  icon: FileText
}, {
  title: "Movimentações",
  url: "/movimentacoes",
  icon: Receipt
}, {
  title: "Cadastros",
  url: "/cadastros",
  icon: Settings2
}];
export function AppSidebar() {
  const {
    state
  } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const {
    signOut,
    user
  } = useAuth();
  const {
    isAdmin
  } = useIsAdmin();
  const {
    data: pendingCount
  } = usePendingTransactionsCount();

  // Fetch user profile and role
  const {
    data: userProfile
  } = useQuery({
    queryKey: ["sidebar-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const {
        data,
        error
      } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });
  const {
    data: userRole
  } = useQuery({
    queryKey: ["sidebar-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const {
        data,
        error
      } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      if (error) return null;
      return data?.role;
    },
    enabled: !!user?.id
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
      user: "Usuário"
    };
    return role ? labels[role] || "Usuário" : "Usuário";
  };
  const getInitials = (name: string | null | undefined): string => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };
  return <Sidebar collapsible="icon" className="border-r-0 transition-all duration-300 sidebar-premium">
      <SidebarHeader className="p-3 pb-2">
        <div className="gap-2 flex-col flex items-center justify-center border-primary">
          <div className="relative">
            <img src={ibbraLogoWhite} alt="Ibbra" className={`${collapsed ? "h-8 w-8" : "h-10"} object-contain shrink-0`} />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-1">
        <SidebarMenu>
          {navItems.map(item => <SidebarMenuItem key={item.title} className="relative">
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={collapsed ? item.title : undefined}>
                <NavLink to={item.url} end={item.url === "/"} className={`flex items-center transition-all duration-200 text-sm py-2 rounded-lg ${collapsed ? "justify-center px-0" : "gap-2.5 px-3"} ${isActive(item.url) ? "bg-sidebar-accent/80 text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                  <item.icon className={`h-4 w-4 shrink-0 ${(item as any).hasBadge && pendingCount && pendingCount > 0 ? "text-accent" : ""} ${isActive(item.url) ? "text-sidebar-primary" : ""}`} />
                  {!collapsed && <span className="whitespace-nowrap flex-1 text-[13px]">{item.title}</span>}
                  {!collapsed && (item as any).hasBadge && pendingCount !== undefined && pendingCount > 0 && <Badge className="h-5 min-w-5 text-[10px] px-1 font-semibold bg-accent text-accent-foreground border-0">
                      {pendingCount > 99 ? "99+" : pendingCount}
                    </Badge>}
                </NavLink>
              </SidebarMenuButton>
              {collapsed && (item as any).hasBadge && pendingCount !== undefined && pendingCount > 0 && <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 bg-accent text-accent-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                  {pendingCount > 9 ? "+" : pendingCount}
                </span>}
            </SidebarMenuItem>)}
        </SidebarMenu>

        {isAdmin && <>
            <SidebarSeparator className="my-2 bg-sidebar-border/50" />
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/admin")} tooltip={collapsed ? "Gerenciar Acessos" : undefined}>
                  <NavLink to="/admin" className={`flex items-center transition-all duration-200 text-sm py-2 rounded-lg ${collapsed ? "justify-center px-0" : "gap-2.5 px-3"} ${isActive("/admin") ? "bg-sidebar-accent/80 text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <Shield className={`h-4 w-4 shrink-0 ${isActive("/admin") ? "text-sidebar-primary" : ""}`} />
                    {!collapsed && <span className="whitespace-nowrap text-[13px]">Gerenciar Acessos</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/padroes-aprendidos")} tooltip={collapsed ? "Padrões Aprendidos" : undefined}>
                  <NavLink to="/padroes-aprendidos" className={`flex items-center transition-all duration-200 text-sm py-2 rounded-lg ${collapsed ? "justify-center px-0" : "gap-2.5 px-3"} ${isActive("/padroes-aprendidos") ? "bg-sidebar-accent/80 text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                    <Brain className={`h-4 w-4 shrink-0 ${isActive("/padroes-aprendidos") ? "text-sidebar-primary" : ""}`} />
                    {!collapsed && <span className="whitespace-nowrap text-[13px]">Padrões Aprendidos</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>}
      </SidebarContent>

      <SidebarFooter className="p-2 pt-0">
        <SidebarSeparator className="mb-2 bg-sidebar-border/50" />
        
        {/* User Profile Section */}
        {!collapsed && <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-sidebar-accent/30 mb-1.5 cursor-pointer hover:bg-sidebar-accent/50 transition-colors" onClick={() => navigate("/perfil")}>
            <Avatar className="h-8 w-8 border-2 border-sidebar-border">
              <AvatarImage src={userProfile?.avatar_url || undefined} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                {getInitials(userProfile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {userProfile?.full_name || "Usuário"}
              </p>
              <p className="text-[9px] text-sidebar-primary font-medium uppercase tracking-wider">
                {getRoleLabel(userRole)}
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-sidebar-muted" />
          </div>}

        {collapsed && <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Meu Perfil" className="justify-center" onClick={() => navigate("/perfil")}>
                <Avatar className="h-7 w-7 border border-sidebar-border">
                  <AvatarImage src={userProfile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                    {getInitials(userProfile?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>}

        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className={`text-destructive/80 hover:bg-destructive/10 hover:text-destructive text-sm py-2 rounded-lg transition-all duration-200 ${collapsed ? "justify-center px-0" : "px-3"}`} tooltip={collapsed ? "Sair" : undefined} onClick={handleSignOut}>
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-[13px]">Sair do Sistema</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>;
}