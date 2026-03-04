import { useLocation, useNavigate } from "react-router-dom";
import { Home, Wallet, CreditCard, BarChart3, Settings2, User, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ibbraLogoWhite from "@/assets/ibbra-logo-white.png";

const modules = [
  { icon: Home, label: "Dashboard", path: "/" },
  { icon: Wallet, label: "Orçamentos", path: "/orcamentos" },
  { icon: CreditCard, label: "Cartões", path: "/cartoes" },
  { icon: TrendingUp, label: "Investimentos", path: "/investimentos" },
  { icon: BarChart3, label: "Relatórios", path: "/relatorios" },
  { icon: Settings2, label: "Cadastros", path: "/contas" },
];

const cadastrosPages = ["/contas", "/categorias", "/centros-custo", "/open-finance", "/regras-conciliacao"];

export function IconSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    if (path === "/contas") return cadastrosPages.includes(location.pathname);
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed left-0 top-0 z-50 flex h-screen w-16 flex-col items-center border-r border-sidebar-border/20 bg-[hsl(213,80%,10%)] py-4">
      {/* Logo */}
      <div className="mb-6 flex items-center justify-center">
        <img src={ibbraLogoWhite} alt="Ibbra" className="h-8 w-8 object-contain" />
      </div>

      {/* Module Icons */}
      <nav className="flex flex-1 flex-col items-center gap-1">
        {modules.map((mod) => {
          const active = isActive(mod.path);
          return (
            <Tooltip key={mod.path} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate(mod.path)}
                  className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                    active
                      ? "bg-[hsl(210,100%,50%)] text-white shadow-lg shadow-[hsl(210,100%,50%)/0.3]"
                      : "text-[hsl(215,18%,58%)] hover:bg-[hsl(213,55%,18%)] hover:text-[hsl(214,30%,88%)]"
                  }`}
                >
                  <mod.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.5} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-medium">
                {mod.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Profile at bottom */}
      <div className="mt-auto">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate("/perfil")}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
                location.pathname === "/perfil"
                  ? "bg-[hsl(210,100%,50%)] text-white"
                  : "text-[hsl(215,18%,58%)] hover:bg-[hsl(213,55%,18%)] hover:text-[hsl(214,30%,88%)]"
              }`}
            >
              <User className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">
            Perfil
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
