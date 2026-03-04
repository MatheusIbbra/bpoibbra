import { Moon, Sun, LogOut, User, Settings, Eye, EyeOff, RefreshCw, Search, Bell, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

interface DesktopTopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function DesktopTopBar({ sidebarOpen, onToggleSidebar }: DesktopTopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { showValues, toggleValues } = useValuesVisibility();
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const navigate = useNavigate();
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
    if (role === "cliente") return "";
    const labels: Record<string, string> = {
      admin: "Admin", supervisor: "Supervisor", kam: "KAM",
      fa: "FA", projetista: "Projetista", user: "User",
    };
    return role ? labels[role] || "User" : "User";
  };

  const displayName = profile?.full_name || "Usuário";
  const firstName = displayName.split(" ")[0];

  return (
    <header className="sticky top-0 z-40 flex h-[72px] items-center border-b border-border/60 bg-card px-6">
      {/* Left: toggle + greeting */}
      <div className="flex items-center gap-4 min-w-0">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {sidebarOpen ? "Recolher menu" : "Expandir menu"}
          </TooltipContent>
        </Tooltip>

        <div className="hidden lg:block">
          <h2 className="text-sm font-semibold text-foreground leading-tight">
            Olá, {firstName}
          </h2>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Mais que pensar em números, pensar em você
          </p>
        </div>
      </div>

      {/* Center: search */}
      <div className="mx-8 flex-1 max-w-xl hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar movimentação, categoria ou conta..."
            className="pl-10 h-10 rounded-xl border-border/50 bg-muted/30 focus:bg-card transition-colors"
          />
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5 ml-auto">
        <BaseSelectorEnhanced />

        {/* Sync OF */}
        {bankConnections && bankConnections.filter(c => c.status === "active").length > 0 && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={handleSyncAllOpenFinance} disabled={isSyncingAll}
                className="h-9 w-9 text-muted-foreground hover:text-foreground">
                <RefreshCw className={`h-4 w-4 ${isSyncingAll ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Sincronizar</TooltipContent>
          </Tooltip>
        )}

        {/* Eye toggle */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggleValues}
              className="h-9 w-9 text-muted-foreground hover:text-foreground">
              {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {showValues ? "Ocultar valores" : "Mostrar valores"}
          </TooltipContent>
        </Tooltip>

        {/* Theme */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggleTheme}
              className="h-9 w-9 text-muted-foreground hover:text-foreground">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {theme === "light" ? "Modo escuro" : "Modo claro"}
          </TooltipContent>
        </Tooltip>

        {/* Notifications placeholder */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground relative">
              <Bell className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Notificações</TooltipContent>
        </Tooltip>

        {/* Insights */}
        <InsightsHeaderButton />

        {/* Separator */}
        <div className="h-6 w-px bg-border/60 mx-1" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-auto gap-2.5 px-2 py-1.5 hover:bg-muted/50 rounded-xl">
              <div className="hidden lg:flex flex-col items-end text-right">
                <span className="text-sm font-medium leading-none text-foreground">{displayName}</span>
                {getRoleLabel(userRole) && (
                  <Badge variant="secondary" className="mt-0.5 text-[9px] px-1.5 py-0 h-4 font-medium rounded-md">
                    {getRoleLabel(userRole)}
                  </Badge>
                )}
              </div>
              <Avatar className="h-9 w-9 border-2 border-border/50">
                <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">
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
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigate("/perfil")} className="cursor-pointer py-2 px-3 rounded-lg">
              <User className="mr-2 h-4 w-4" /> Meu Perfil
            </DropdownMenuItem>
            {userRole && userRole !== "cliente" && (
              <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer py-2 px-3 rounded-lg">
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
    </header>
  );
}
