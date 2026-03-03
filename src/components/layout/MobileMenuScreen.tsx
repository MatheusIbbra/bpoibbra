import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Target, CreditCard, Upload, BarChart3, ArrowLeftRight,
  TrendingUp, FileText, Tag, Wallet, Layers, Brain, Building,
  User, Shield, Settings, LogOut, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const mainItems = [
  { label: "Orçamentos", icon: Target, path: "/orcamentos" },
  { label: "Cartões de Crédito", icon: CreditCard, path: "/cartoes" },
  { label: "Importar Extratos", icon: Upload, path: "/importacoes" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { label: "Movimentações", icon: ArrowLeftRight, path: "/movimentacoes" },
  { label: "Fluxo de Caixa", icon: TrendingUp, path: "/relatorio-fluxo-caixa" },
  { label: "DRE", icon: FileText, path: "/relatorio-dre" },
  { label: "Categorias", icon: Tag, path: "/categorias" },
  { label: "Contas", icon: Wallet, path: "/contas" },
  { label: "Centros de Custo", icon: Layers, path: "/centros-custo" },
  { label: "Análises", icon: Brain, path: "/relatorios" },
  { label: "Open Finance", icon: Building, path: "/open-finance" },
];

const settingsItems = [
  { label: "Meu Perfil", icon: User, path: "/perfil" },
  { label: "Segurança", icon: Shield, path: "/perfil" },
  { label: "Preferências", icon: Settings, path: "/perfil" },
];

interface MobileMenuScreenProps {
  onClose: () => void;
}

export function MobileMenuScreen({ onClose }: MobileMenuScreenProps) {
  const navigate = useNavigate();
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

  const { data: subscription } = useQuery({
    queryKey: ["subscription-label", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("organization_subscriptions")
        .select("plans(name)")
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      return (data?.plans as { name: string } | null)?.name || "Plano Essencial";
    },
    enabled: !!user?.id,
  });

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const displayName = profile?.full_name || "Usuário";

  const handleNav = (path: string) => {
    onClose();
    setTimeout(() => navigate(path), 150);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Drag handle */}
      <div className="mx-auto w-8 h-0.5 rounded-full bg-muted-foreground/20 mt-3 mb-4 shrink-0" />

      {/* User header */}
      <div className="px-5 pb-5 border-b border-border/30">
        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 border-2 border-border/30">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback
              className="text-sm font-semibold"
              style={{ backgroundColor: "hsl(var(--brand-deep))", color: "white" }}
            >
              {getInitials(profile?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            <span className="inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-medium uppercase tracking-wide"
              style={{ backgroundColor: "hsl(var(--brand-deep)/0.08)", color: "hsl(var(--brand-deep))" }}>
              {subscription || "Essencial"}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Main grid */}
        <div>
          <p className="text-[9px] uppercase tracking-[0.16em] font-semibold text-muted-foreground/60 mb-3 px-1">
            Recursos
          </p>
          <div className="grid grid-cols-3 gap-2">
            {mainItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNav(item.path)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-secondary/30 border border-border/20 hover:bg-secondary/60 hover:border-border/40 transition-all duration-150 group"
              >
                <item.icon
                  className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors"
                  strokeWidth={1.5}
                />
                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground text-center leading-tight transition-colors">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Settings section */}
        <div>
          <p className="text-[9px] uppercase tracking-[0.16em] font-semibold text-muted-foreground/60 mb-2 px-1">
            Configurações
          </p>
          <div className="rounded-2xl border border-border/20 overflow-hidden divide-y divide-border/20">
            {settingsItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNav(item.path)}
                className="w-full flex items-center justify-between px-4 py-3.5 bg-secondary/20 hover:bg-secondary/40 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-sm text-foreground">{item.label}</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
              </button>
            ))}
            <button
              onClick={async () => { onClose(); await signOut(); }}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-secondary/20 hover:bg-destructive/5 transition-colors"
            >
              <LogOut className="h-4 w-4 text-destructive/70" strokeWidth={1.5} />
              <span className="text-sm text-destructive/80">Sair do aplicativo</span>
            </button>
          </div>
        </div>

        <div className="pb-4" />
      </div>
    </div>
  );
}
