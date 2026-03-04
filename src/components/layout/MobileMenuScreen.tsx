import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import {
  BarChart3, TrendingUp, FileText, Brain,
  Wallet, Tag, Layers, Upload, Building,
  User, Shield, Settings, ChevronRight,
  Moon, Bell, ArrowUpRight, CreditCard, Target,
  PieChart, LayoutDashboard
} from "lucide-react";

const reportItems = [
  { label: "Movimentações", icon: BarChart3, path: "/relatorios?tab=movimentacoes" },
  { label: "Fluxo de Caixa", icon: TrendingUp, path: "/relatorios?tab=fluxo" },
  { label: "DRE", icon: FileText, path: "/relatorios?tab=dre" },
  { label: "Orçamento", icon: Target, path: "/relatorios?tab=analise" },
  { label: "Demonstrativo", icon: LayoutDashboard, path: "/relatorios?tab=demonstrativo" },
  { label: "Tipo Financeiro", icon: PieChart, path: "/relatorios?tab=tipo-financeiro" },
  { label: "Análise Categorias", icon: CreditCard, path: "/relatorios?tab=categorias" },
  { label: "Análises Estratégicas", icon: Brain, path: "/relatorios?tab=estrategico" },
];

const cadastroItems = [
  { label: "Contas", icon: Wallet, path: "/contas" },
  { label: "Categorias", icon: Tag, path: "/categorias" },
  { label: "Grupo de Custos", icon: Layers, path: "/centros-custo" },
  { label: "Open Finance", icon: Building, path: "/open-finance" },
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

function MenuRow({ icon: Icon, label, onClick, trailing }: { icon: React.ElementType; label: string; onClick?: () => void; trailing?: React.ReactNode }) {
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
      {trailing || <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />}
    </button>
  );
}

export function MobileMenuScreen({ onClose }: MobileMenuScreenProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { openUpgradeModal } = useUpgradeModal();

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
      return (data?.plans as { name: string } | null)?.name || "Plano Free";
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
              <button
                onClick={() => openUpgradeModal()}
                className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider hover:opacity-80 transition-opacity"
                style={{ backgroundColor: "hsl(var(--brand-deep)/0.07)", color: "hsl(var(--brand-deep))" }}
              >
                {subscription || "Plano Free"}
                <ArrowUpRight className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>

          {/* Quick settings */}
          <div className="flex gap-2 mt-4">
            {[
              { label: "Perfil", icon: User, path: "/perfil" },
              { label: "Segurança", icon: Shield, path: "/perfil" },
              { label: "Preferências", icon: Settings, path: "/perfil" },
            ].map((item) => (
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
          {/* Configurações */}
          <div>
            <SectionLabel>Configurações</SectionLabel>
            <div className="rounded-2xl border border-border/15 overflow-hidden divide-y divide-border/15">
              <MenuRow icon={Bell} label="Notificações" onClick={() => handleNav("/perfil")} />
              <MenuRow icon={Settings} label="Configurações" onClick={() => handleNav("/perfil")} />
              <div className="w-full flex items-center justify-between px-4 py-3 bg-secondary/10">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-secondary/40 flex items-center justify-center shrink-0">
                    <Moon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <span className="text-sm text-foreground">Modo Escuro</span>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
              </div>
            </div>
          </div>

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

        {/* bottom padding */}
        <div className="pb-8" />
      </div>
    </div>
  );
}
