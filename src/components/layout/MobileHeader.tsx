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
import { useNavigate } from "react-router-dom";
import ibbraLogoWhite from "@/assets/ibbra-logo-white.png";
import ibbraLogoIcon from "@/assets/ibbra-logo-icon.png";

export function MobileHeader() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { showValues, toggleValues } = useValuesVisibility();
  const navigate = useNavigate();

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
    <header className="sticky top-0 z-40 px-5 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 max-w-[420px] mx-auto w-full">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <img
          src={theme === "dark" ? ibbraLogoWhite : ibbraLogoIcon}
          alt="Ibbra"
          className="h-7 object-contain"
        />

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleValues}
            className="h-10 w-10 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
          >
            {showValues ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-10 w-10 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
          >
            {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="ml-0.5">
                <Avatar className="h-9 w-9 border-2 border-primary/20 transition-all duration-300 hover:border-primary/40 shadow-sm">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                    {getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-[20px] p-2.5 shadow-executive-lg border-border/30">
              <div className="px-3 py-3 mb-1.5 bg-muted/40 rounded-2xl">
                <p className="text-sm font-semibold">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
              </div>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem onClick={() => navigate("/perfil")} className="rounded-xl py-3 cursor-pointer text-sm">
                <User className="mr-2.5 h-4 w-4" /> Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border/30" />
              <DropdownMenuItem onClick={signOut} className="rounded-xl py-3 text-destructive cursor-pointer text-sm">
                <LogOut className="mr-2.5 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Greeting */}
      <div className="mt-5">
        <p className="text-muted-foreground text-sm">Olá,</p>
        <h2 className="text-2xl font-bold tracking-tight mt-0.5">
          {displayName.split(" ")[0]} 👋
        </h2>
      </div>
    </header>
  );
}
