import { Moon, Sun, LogOut, User, Settings, Eye, EyeOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useValuesVisibility } from "@/contexts/ValuesVisibilityContext";
import { BaseSelectorEnhanced } from "./BaseSelectorEnhanced";
import { InsightsHeaderButton } from "./InsightsHeaderButton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOpenFinanceStatus } from "@/hooks/useOpenFinanceStatus";
import { useNavigate } from "react-router-dom";
import { useBankConnections, useSyncBankConnection } from "@/hooks/useBankConnections";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useAutoIgnoreTransfers } from "@/hooks/useAutoIgnoreTransfers";
import { useState } from "react";
import { toast } from "sonner";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title = "Posição Patrimonial" }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { showValues, toggleValues } = useValuesVisibility();
  const { openUpgradeModal } = useUpgradeModal();
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const navigate = useNavigate();
  const { overallStatus, hasItems, errorCount, staleCount } = useOpenFinanceStatus();
  const { data: bankConnections } = useBankConnections();
  const syncConnection = useSyncBankConnection();
  const autoIgnoreTransfers = useAutoIgnoreTransfers();
  const { getRequiredOrganizationId } = useBaseFilter();

  const handleSyncAllOpenFinance = async () => {
    const orgId = getRequiredOrganizationId();
    if (!orgId) { toast.error("Selecione uma base antes de sincronizar."); return; }
    const activeConnections = bankConnections?.filter(c => c.status === "active") || [];
    if (activeConnections.length === 0) { toast.info("Nenhuma conexão ativa para sincronizar."); return; }
    setIsSyncingAll(true);
    toast.info("Atualização do Open Finance em Andamento", { duration: 4000 });
    let totalImported = 0;
    for (const conn of activeConnections) {
      try {
        const result = await syncConnection.mutateAsync({ organizationId: orgId, bankConnectionId: conn.id });
        totalImported += result.imported || 0;
      } catch { /* ignore individual errors */ }
    }
    try { await autoIgnoreTransfers.mutateAsync(orgId); } catch {}
    setIsSyncingAll(false);
    toast.success(`Sincronização concluída: ${totalImported} transações importadas.`);
  };

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: userRole } = useQuery({
    queryKey: ["header-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      return data?.role;
    },
    enabled: !!user?.id,
  });

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getRoleLabel = (role: string | null | undefined): string => {
    if (role === 'cliente') return '';
    const labels: Record<string, string> = {
      admin: "Admin", supervisor: "Supervisor", kam: "KAM",
      fa: "FA", projetista: "Projetista", user: "User",
    };
    return role ? labels[role] || "User" : "User";
  };

  const displayName = profile?.full_name || "Usuário";

  return (
    <header className="sticky top-0 z-40 border-b border-sidebar-border/20 bg-[hsl(var(--sidebar-background))]">
      {/* ── Linha institucional superior ── */}
      <div className="hidden md:flex items-center justify-between px-6 pt-3 pb-1.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-sidebar-foreground/80"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            IBBRA
          </span>
          <span className="text-sidebar-border/50 text-[10px]">|</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-sidebar-muted"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Autonomia Patrimonial
          </span>
          <span className="text-sidebar-border/30 text-[10px]">·</span>
          <span className="text-[9px] italic text-sidebar-muted/50"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Mais que pensar em números, pensar em você.
          </span>
        </div>
        <span className="text-[8px] uppercase tracking-[0.2em] text-sidebar-muted/40 font-medium">
          Acompanhamento estratégico consolidado
        </span>
      </div>

      {/* ── Linha funcional ── */}
      <div className="flex h-12 items-center gap-2 md:gap-3 px-3 md:px-5">
        {/* Sidebar toggle */}
        <SidebarTrigger className="shrink-0 h-8 w-8 md:h-9 md:w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-lg transition-all duration-200" />

        <div className="flex flex-1 items-center gap-2 md:gap-3 min-w-0">
          {/* Mobile: institutional greeting for clients */}
          {userRole === 'cliente' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex md:hidden items-center gap-1.5 px-3 py-1 rounded-lg hover:bg-sidebar-accent/30 transition-all mx-auto">
                  <Avatar className="h-6 w-6 border border-sidebar-border/50">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-[10px] font-semibold">
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-sidebar-foreground">
                    Olá, {displayName.split(' ')[0]}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-44">
                <DropdownMenuItem onClick={() => navigate('/perfil')} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" /> Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                  {theme === "light" ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                  {theme === "light" ? "Modo Escuro" : "Modo Claro"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Base Selector */}
          <div className="shrink-0">
            <BaseSelectorEnhanced />
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-1.5">
          {/* Sync Open Finance */}
          {bankConnections && bankConnections.filter(c => c.status === "active").length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleSyncAllOpenFinance} disabled={isSyncingAll}
                  className="h-8 w-8 md:h-9 md:w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-lg transition-all duration-200">
                  <RefreshCw className={`h-4 w-4 ${isSyncingAll ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Sincronizar Open Finance</TooltipContent>
            </Tooltip>
          )}

          {/* Eye toggle */}
          <Button variant="ghost" size="icon" onClick={toggleValues}
            className="h-8 w-8 md:h-9 md:w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-lg transition-all duration-200">
            {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>

          {/* Insights */}
          <div className="hidden md:block">
            <InsightsHeaderButton />
          </div>

          {/* Theme toggle */}
          <Button variant="ghost" size="icon" onClick={toggleTheme}
            className={cn(
              "h-8 w-8 md:h-9 md:w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-lg transition-all duration-200",
              userRole === 'cliente' && "hidden md:flex"
            )}>
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          {/* Divider */}
          <div className="hidden lg:block h-5 w-px bg-sidebar-border/40 mx-0.5" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost"
                className={cn(
                  "relative h-auto gap-2 px-2 py-1.5 shrink-0 hover:bg-sidebar-accent/40 transition-all duration-200 rounded-lg",
                  userRole === 'cliente' && "hidden md:flex"
                )}>
                <div className="hidden lg:flex flex-col items-end text-right">
                  <span className="text-sm font-medium leading-none text-sidebar-foreground">{displayName}</span>
                  {getRoleLabel(userRole) && (
                    <Badge className="mt-0.5 text-[9px] px-1.5 py-0 h-4 font-medium rounded-md bg-sidebar-accent text-sidebar-accent-foreground border-0">
                      {getRoleLabel(userRole)}
                    </Badge>
                  )}
                </div>
                <Avatar className="h-8 w-8 md:h-9 md:w-9 border-2 border-sidebar-border/50">
                  <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                  <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground font-semibold text-xs">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 p-2" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-2 bg-muted/50 rounded-lg mb-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-9 w-9 border-2 border-border/60">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-semibold leading-none">{displayName}</p>
                    <p className="text-xs leading-none text-muted-foreground truncate max-w-[120px]">{user?.email}</p>
                    {getRoleLabel(userRole) && (
                      <Badge variant="secondary" className="w-fit text-[9px] px-1 py-0 h-3.5 mt-0.5">
                        {getRoleLabel(userRole)}
                      </Badge>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate('/perfil')} className="cursor-pointer py-2 px-3 rounded-lg">
                <User className="mr-2 h-4 w-4" /> Meu Perfil
              </DropdownMenuItem>
              {userRole && userRole !== 'cliente' && (
                <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer py-2 px-3 rounded-lg">
                  <Settings className="mr-2 h-4 w-4" /> Configurações
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem className="text-destructive cursor-pointer py-2 px-3 rounded-lg hover:bg-destructive/10" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Sair do Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
