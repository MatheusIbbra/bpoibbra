import { Moon, Sun, LogOut, User, Settings, Eye, EyeOff, TrendingUp, Radio, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePlanLimits } from "@/hooks/usePlanLimits";
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

export function AppHeader({ title = "Dashboard" }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { showValues, toggleValues } = useValuesVisibility();
  const { usage } = usePlanLimits();
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

  const mainUsagePercent = usage
    ? Math.max(usage.transactionsPercent, usage.aiRequestsPercent, usage.bankConnectionsPercent)
    : 0;
  const usageColor = mainUsagePercent >= 90 ? "bg-destructive" : mainUsagePercent >= 70 ? "bg-warning" : "bg-[hsl(var(--brand-highlight))]";

  const ofStatusColor = overallStatus === "ok"
    ? "text-green-500"
    : overallStatus === "warning"
    ? "text-yellow-500"
    : overallStatus === "error"
    ? "text-destructive"
    : "text-muted-foreground/40";

  const ofStatusLabel = overallStatus === "ok"
    ? "Open Finance: Tudo OK"
    : overallStatus === "warning"
    ? `Open Finance: ${staleCount} item(ns) desatualizado(s)`
    : overallStatus === "error"
    ? `Open Finance: ${errorCount} conexão(ões) com erro`
    : "Open Finance: Sem conexões";

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
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = (role: string | null | undefined): string => {
    if (role === 'cliente') return ''; // Don't show "Cliente" label
    const labels: Record<string, string> = {
      admin: "Admin",
      supervisor: "Supervisor",
      kam: "KAM",
      fa: "FA",
      projetista: "Projetista",
      user: "User",
    };
    return role ? labels[role] || "User" : "User";
  };

  const displayName = profile?.full_name || "Usuário";

  return (
    <header className="sticky top-0 z-40 flex h-14 md:h-[60px] items-center gap-2 md:gap-3 border-b border-sidebar-border/20 bg-[hsl(var(--sidebar-background))] px-3 md:px-6">
      {/* Sidebar toggle */}
      <SidebarTrigger className="shrink-0 h-8 w-8 md:h-9 md:w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-lg transition-all duration-200" />
      
      <div className="flex flex-1 items-center gap-2 md:gap-4 min-w-0">
      {/* Title or greeting - mobile: centered profile button for clients */}
        <div className="hidden md:flex flex-col">
          <h1 className="text-[15px] font-medium text-sidebar-foreground/90 tracking-tight" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
            {userRole === 'cliente' ? `Olá, ${displayName.split(' ')[0]}` : title}
          </h1>
        </div>
        
        {/* Mobile: centered client greeting with dropdown */}
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
                <span className="text-sm font-medium text-sidebar-foreground">Olá, {displayName.split(' ')[0]}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-44">
              <DropdownMenuItem onClick={() => navigate('/perfil')} className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                {theme === "light" ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                {theme === "light" ? "Modo Escuro" : "Modo Claro"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                Sair do Sistema
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
        {/* Sync Open Finance button */}
        {bankConnections && bankConnections.filter(c => c.status === "active").length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSyncAllOpenFinance}
                disabled={isSyncingAll}
                className="h-8 w-8 md:h-9 md:w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-lg transition-all duration-200"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncingAll ? "animate-spin" : ""}`} />
                <span className="sr-only">Sincronizar Open Finance</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Sincronizar Open Finance</TooltipContent>
          </Tooltip>
        )}

        {/* Eye toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleValues}
          className="h-8 w-8 md:h-9 md:w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-lg transition-all duration-200"
          title={showValues ? "Ocultar valores" : "Mostrar valores"}
        >
          {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <span className="sr-only">{showValues ? "Ocultar valores" : "Mostrar valores"}</span>
        </Button>

        {/* Plan usage indicator */}
        {usage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => openUpgradeModal("general")}
                className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-sidebar-accent/40 transition-all duration-200 cursor-pointer"
              >
                <TrendingUp className="h-3.5 w-3.5 text-sidebar-foreground/60" />
                <div className="flex flex-col gap-0.5 min-w-[80px]">
                  <span className="text-[10px] text-sidebar-foreground/50 leading-none">{usage.planName}</span>
                  <Progress value={mainUsagePercent} className="h-1.5 bg-sidebar-accent/30" indicatorClassName={usageColor} />
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p className="font-medium mb-1">{usage.planName}</p>
              <p>Transações: {usage.transactionsUsed}/{usage.transactionsLimit}</p>
              <p>IA: {usage.aiRequestsUsed}/{usage.aiRequestsLimit}</p>
              <p>Conexões: {usage.bankConnectionsUsed}/{usage.bankConnectionsLimit}</p>
              <p className="text-muted-foreground mt-1">Clique para ver planos</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Insights button */}
        <div className="hidden md:block">
          <InsightsHeaderButton />
        </div>

        {/* Theme toggle - hidden on mobile for clients (available in dropdown) */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme} 
          className={cn(
            "h-8 w-8 md:h-9 md:w-9 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-lg transition-all duration-200",
            userRole === 'cliente' && "hidden md:flex"
          )}
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          <span className="sr-only">Alternar tema</span>
        </Button>

        {/* Divider */}
        <div className="hidden lg:block h-5 w-px bg-sidebar-border/40 mx-0.5" />

        {/* User menu - hidden on mobile for clients */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "relative h-auto gap-2 px-2 py-1.5 shrink-0 hover:bg-sidebar-accent/40 transition-all duration-200 rounded-lg",
                userRole === 'cliente' && "hidden md:flex"
              )}
            >
              {/* User info */}
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
                  <p className="text-xs leading-none text-muted-foreground truncate max-w-[120px]">
                    {user?.email}
                  </p>
                  {getRoleLabel(userRole) && (
                    <Badge variant="secondary" className="w-fit text-[9px] px-1 py-0 h-3.5 mt-0.5">
                      {getRoleLabel(userRole)}
                    </Badge>
                  )}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuItem 
              onClick={() => window.location.href = '/perfil'}
              className="cursor-pointer py-2 px-3 rounded-lg"
            >
              <User className="mr-2 h-4 w-4" />
              Meu Perfil
            </DropdownMenuItem>
            {userRole && userRole !== 'cliente' && (
              <DropdownMenuItem 
                onClick={() => window.location.href = '/admin'}
                className="cursor-pointer py-2 px-3 rounded-lg"
              >
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem 
              className="text-destructive cursor-pointer py-2 px-3 rounded-lg hover:bg-destructive/10" 
              onClick={signOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair do Sistema
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
