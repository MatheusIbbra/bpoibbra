import { Moon, Sun, LogOut, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
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
import { BaseSelectorEnhanced } from "./BaseSelectorEnhanced";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AppHeaderProps {
  title?: string;
}

export function AppHeader({ title = "Dashboard" }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();

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
    const labels: Record<string, string> = {
      admin: "Admin",
      supervisor: "Supervisor",
      kam: "KAM",
      fa: "FA",
      projetista: "Projetista",
      cliente: "Cliente",
      user: "User",
    };
    return role ? labels[role] || "User" : "User";
  };

  const displayName = profile?.full_name || "Usuário";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border/60 bg-card/95 backdrop-blur-sm px-4 md:px-6 shadow-sm">
      {/* Sidebar toggle */}
      <SidebarTrigger className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" />
      
      <div className="flex flex-1 items-center gap-4 min-w-0">
        {/* Title */}
        <div className="hidden md:flex flex-col">
          <h1 className="text-base font-semibold text-foreground tracking-tight">
            {title}
          </h1>
        </div>
        
        {/* Base Selector */}
        <div className="shrink-0">
          <BaseSelectorEnhanced />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme} 
          className="hidden md:inline-flex h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {theme === "light" ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          <span className="sr-only">Alternar tema</span>
        </Button>

        {/* Divider */}
        <div className="hidden lg:block h-6 w-px bg-border/60 mx-1" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="relative h-auto gap-2 px-2 py-1 shrink-0 hover:bg-muted transition-colors rounded-lg"
            >
              {/* User info */}
              <div className="hidden lg:flex flex-col items-end text-right">
                <span className="text-sm font-medium leading-none text-foreground">{displayName}</span>
                <Badge variant="secondary" className="mt-0.5 text-[9px] px-1 py-0 h-3.5 font-medium">
                  {getRoleLabel(userRole)}
                </Badge>
              </div>
              <Avatar className="h-8 w-8 border-2 border-border/60">
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
                  <p className="text-xs leading-none text-muted-foreground truncate max-w-[120px]">
                    {user?.email}
                  </p>
                  <Badge variant="secondary" className="w-fit text-[9px] px-1 py-0 h-3.5 mt-0.5">
                    {getRoleLabel(userRole)}
                  </Badge>
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
            <DropdownMenuItem 
              onClick={() => window.location.href = '/admin'}
              className="cursor-pointer py-2 px-3 rounded-lg"
            >
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            {/* Theme toggle - mobile */}
            <DropdownMenuItem 
              onClick={toggleTheme} 
              className="md:hidden cursor-pointer py-2 px-3 rounded-lg"
            >
              {theme === "light" ? (
                <>
                  <Moon className="mr-2 h-4 w-4" />
                  Modo Escuro
                </>
              ) : (
                <>
                  <Sun className="mr-2 h-4 w-4" />
                  Modo Claro
                </>
              )}
            </DropdownMenuItem>
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
