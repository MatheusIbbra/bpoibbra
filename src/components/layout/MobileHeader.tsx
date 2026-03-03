import { Moon, Sun, Eye, EyeOff, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useValuesVisibility } from "@/contexts/ValuesVisibilityContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import ibbraLogoWhite from "@/assets/ibbra-logo-white.png";
import ibbraLogoIcon from "@/assets/ibbra-logo-icon.png";

export function MobileHeader() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { showValues, toggleValues } = useValuesVisibility();
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";

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

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const displayName = profile?.full_name || "Usuário";

  return (
    <header className="px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-3 max-w-[420px] mx-auto w-full">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <img
          src={theme === "dark" ? ibbraLogoWhite : ibbraLogoIcon}
          alt="Ibbra"
          className="h-7 object-contain"
        />

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleValues}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all duration-200"
          >
            {showValues ? <Eye className="h-[17px] w-[17px]" /> : <EyeOff className="h-[17px] w-[17px]" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all duration-200"
          >
            {theme === "light" ? <Moon className="h-[17px] w-[17px]" /> : <Sun className="h-[17px] w-[17px]" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-1">
                <Avatar className="h-8 w-8 border border-[#011E41]/20 transition-all duration-300 shadow-sm">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-[#011E41] text-white text-xs font-medium" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-2 shadow-fintech-lg border-border/20">
              <div className="px-3 py-3 mb-1 bg-muted/30 rounded-xl">
                <p className="text-sm font-semibold text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-border/20" />
              <DropdownMenuItem onClick={() => navigate("/perfil")} className="rounded-lg py-2.5 cursor-pointer text-sm">
                <User className="mr-2.5 h-4 w-4" /> Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/20" />
              <DropdownMenuItem onClick={signOut} className="rounded-lg py-2.5 text-destructive cursor-pointer text-sm">
                <LogOut className="mr-2.5 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Institutional greeting — only on home */}
      {isHome && (
        <div className="mt-4 mb-1">
          <p className="text-muted-foreground/60 text-xs font-medium">Olá,</p>
          <h2
            className="text-[24px] font-light tracking-tight text-foreground"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: "-0.015em" }}
          >
            {displayName.split(" ")[0]}
          </h2>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5 italic" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Mais que pensar em números, pensar em você.
          </p>
        </div>
      )}
    </header>
  );
}
