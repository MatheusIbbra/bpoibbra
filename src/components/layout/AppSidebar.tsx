import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, Upload, AlertCircle, User, ChevronRight, Home, Receipt, Settings2, Wallet, FileText, Shield, Brain, Building2, CreditCard, BarChart3 } from "lucide-react";
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
import ibbraLogoFullWhite from "@/assets/ibbra-logo-full-white.png";

const navItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Open Finance", url: "/open-finance", icon: Building2 },
  { title: "Cartões de Crédito", url: "/cartoes", icon: CreditCard },
  { title: "Orçamentos", url: "/orcamentos", icon: Wallet },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Pendências", url: "/pendencias", icon: AlertCircle },
  { title: "Importar Extratos", url: "/importacoes", icon: Upload },
  { title: "Cadastros", url: "/cadastros", icon: Settings2 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { data: pendingCount } = usePendingTransactionsCount();

  const { data: userProfile } = useQuery({
    queryKey: ["sidebar-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: userRole } = useQuery({
    queryKey: ["sidebar-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
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
      admin: "Administrador", supervisor: "Supervisor", kam: "KAM",
      fa: "FA", projetista: "Projetista", cliente: "Cliente", user: "Usuário"
    };
    return role ? labels[role] || "Usuário" : "Usuário";
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
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
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarMenu>
          {navItems.map(item => (
            <SidebarMenuItem key={item.title} className="relative">
              <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={collapsed ? item.title : undefined}>
                <NavLink to={item.url} end={item.url === "/"} className={`flex items-center transition-all duration-200 text-sm py-2.5 rounded-xl ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${isActive(item.url) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/40"}`} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                  <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive(item.url) ? "text-sidebar-primary" : ""}`} />
                  {!collapsed && (
                    <span className="whitespace-nowrap flex-1 text-[13px]">
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
          ))}
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
          </SidebarMenu>
        </>}
      </SidebarContent>

      <SidebarFooter className="p-3 pt-0">
        <SidebarSeparator className="mb-3 bg-sidebar-border/40" />
        
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-sidebar-accent/30 mb-2 cursor-pointer hover:bg-sidebar-accent/50 transition-all duration-200" onClick={() => navigate("/perfil")}>
            <Avatar className="h-9 w-9 border-2 border-sidebar-border/60">
              <AvatarImage src={userProfile?.avatar_url || undefined} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold">
                {getInitials(userProfile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {userProfile?.full_name || "Usuário"}
              </p>
              <p className="text-[9px] text-sidebar-primary font-semibold uppercase tracking-wider">
                {getRoleLabel(userRole)}
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-sidebar-muted" />
          </div>
        )}

        {collapsed && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Meu Perfil" className="justify-center" onClick={() => navigate("/perfil")}>
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
