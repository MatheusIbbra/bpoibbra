import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  BarChart3, TrendingUp, FileText, Brain,
  Wallet, Tag, Layers, Upload, Building,
  User, Shield, Settings, LogOut, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const reportItems = [
  { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { label: "Fluxo de Caixa", icon: TrendingUp, path: "/relatorio-fluxo-caixa" },
  { label: "DRE", icon: FileText, path: "/relatorio-dre" },
  { label: "Análises Estratégicas", icon: Brain, path: "/relatorios" },
];

const cadastroItems = [
  { label: "Contas", icon: Wallet, path: "/contas" },
  { label: "Categorias", icon: Tag, path: "/categorias" },
  { label: "Centros de Custo", icon: Layers, path: "/centros-custo" },
  { label: "Importar Extratos", icon: Upload, path: "/importacoes" },
  { label: "Open Finance", icon: Building, path: "/open-finance" },
];

const quickSettingsItems = [
  { label: "Perfil", icon: User, path: "/perfil" },
  { label: "Segurança", icon: Shield, path: "/perfil" },
  { label: "Preferências", icon: Settings, path: "/perfil" },
];

interface MobileMenuScreenProps {
  onClose: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] uppercase tracking-[0.18em] font-semibold text-muted-foreground/50 mb-2.5 px-1">
      {children}
    </p>
  );
}

function MenuRow({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 bg-secondary/10 hover:bg-secondary/30 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-secondary/40 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        </div>
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
    </button>
  );
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

  const handleNav = (path: string) => {
    onClose();
    setTimeout(() => navigate(path), 150);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Drag handle */}
      <div className="mx-auto w-8 h-1 rounded-full bg-muted-foreground/15 mt-3 mb-5 shrink-0" />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* User header */}
        <div className="px-5 pb-5 border-b border-border/20">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border border-border/20 shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback
                className="text-sm font-semibold"
                style={{ backgroundColor: "hsl(var(--brand-deep))", color: "white" }}
              >
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground truncate">
                {profile?.full_name || "Usuário"}
              </p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{user?.email}</p>
              <span
                className="inline-flex items-center mt-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: "hsl(var(--brand-deep)/0.07)", color: "hsl(var(--brand-deep))" }}
              >
                {subscription || "Essencial"}
              </span>
            </div>
          </div>

          {/* Quick settings */}
          <div className="flex gap-2 mt-4">
            {quickSettingsItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNav(item.path)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-2xl bg-secondary/25 hover:bg-secondary/50 transition-colors border border-border/15"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-[10px] font-medium text-muted-foreground">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Relatórios */}
          <div>
            <SectionLabel>Relatórios</SectionLabel>
            <div className="rounded-2xl border border-border/15 overflow-hidden divide-y divide-border/15">
              {reportItems.map((item) => (
                <MenuRow key={item.label} icon={item.icon} label={item.label} onClick={() => handleNav(item.path)} />
              ))}
            </div>
          </div>

          {/* Cadastros */}
          <div>
            <SectionLabel>Cadastros</SectionLabel>
            <div className="rounded-2xl border border-border/15 overflow-hidden divide-y divide-border/15">
              {cadastroItems.map((item) => (
                <MenuRow key={item.label} icon={item.icon} label={item.label} onClick={() => handleNav(item.path)} />
              ))}
            </div>
          </div>
        </div>

        {/* Sair */}
        <div className="px-5 pb-8">
          <button
            onClick={async () => { onClose(); await signOut(); }}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border border-border/20 text-muted-foreground hover:text-foreground hover:bg-secondary/20 transition-colors"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
            <span className="text-sm font-medium">Sair do aplicativo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
