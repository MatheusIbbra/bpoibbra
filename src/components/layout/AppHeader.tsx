import { Search, Moon, Sun, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
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

  // Buscar o perfil do usuário para obter o nome
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

  // Gerar inicial do nome (sempre primeira letra do nome)
  const getInitial = (name: string | null | undefined): string => {
    if (!name) return "U";
    return name.trim().charAt(0).toUpperCase();
  };

  const initial = getInitial(profile?.full_name);
  const displayName = profile?.full_name || "Usuário";

  return (
    <header className="sticky top-0 z-40 flex h-14 md:h-16 items-center gap-2 md:gap-4 border-b bg-card px-3 md:px-6">
      {/* Sidebar toggle - always visible */}
      <SidebarTrigger className="shrink-0" />
      
      <div className="flex flex-1 items-center gap-2 md:gap-4 min-w-0">
        {/* Title - hidden on mobile */}
        <h1 className="hidden md:block text-lg font-semibold text-foreground md:text-xl lg:text-2xl truncate">
          {title}
        </h1>
        
        {/* Base Selector - always visible */}
        <div className="shrink-0">
          <BaseSelectorEnhanced />
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2">
        {/* Search - hidden on mobile/tablet */}
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar transações..."
            className="w-64 pl-9 bg-background"
          />
        </div>

        {/* Theme toggle - hidden on mobile/tablet */}
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="hidden md:inline-flex shrink-0">
          {theme === "light" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
          <span className="sr-only">Alternar tema</span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-auto gap-2 px-2 py-1.5 shrink-0">
              {/* User info - hidden on mobile/tablet */}
              <div className="hidden lg:flex flex-col items-end text-right">
                <span className="text-sm font-medium leading-none">{displayName}</span>
                <span className="text-xs text-muted-foreground leading-none mt-0.5">
                  {user?.email}
                </span>
              </div>
              <Avatar className="h-8 w-8 md:h-9 md:w-9">
                <AvatarImage src={profile?.avatar_url || undefined} alt="Avatar" />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-sm">
                  {initial}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.href = '/perfil'}>
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.location.href = '/admin'}>
              Configurações
            </DropdownMenuItem>
            {/* Theme toggle - visible only on mobile/tablet in dropdown */}
            <DropdownMenuItem onClick={toggleTheme} className="md:hidden">
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
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
