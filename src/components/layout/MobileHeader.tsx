import { Eye, EyeOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useValuesVisibility } from "@/contexts/ValuesVisibilityContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "react-router-dom";
import ibbraLogoWhite from "@/assets/ibbra-logo-full-white.png";
import ibbraLogoIcon from "@/assets/ibbra-logo-icon.png";
import { useTheme } from "@/contexts/ThemeContext";

export function MobileHeader() {
  const { showValues, toggleValues } = useValuesVisibility();
  const { theme } = useTheme();
  const { user } = useAuth();
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

        {/* Right: only eye toggle */}
        <button
          onClick={toggleValues}
          className="flex items-center justify-center h-9 w-9 rounded-xl text-foreground/60 hover:text-foreground hover:bg-accent/40 transition-all"
        >
          {showValues ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
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
