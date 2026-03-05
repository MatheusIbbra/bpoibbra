import { useLocation, useNavigate } from "react-router-dom";
import { Home, Target, Plus, Menu, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { hapticLight } from "@/lib/haptics";

const navItems = [
  { label: "Visão", icon: Home, path: "/" },
  { label: "Orçamentos", icon: Target, path: "/orcamentos" },
  { label: "", icon: Plus, path: "__fab__" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { label: "Menu", icon: Menu, path: "__menu__" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleFabClick = () => {
    hapticLight();
    window.dispatchEvent(new CustomEvent("ibbra:fab-toggle"));
  };

  const handleMenuClick = () => {
    hapticLight();
    window.dispatchEvent(new CustomEvent("ibbra:mobile-menu-toggle"));
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="mx-auto max-w-screen-sm px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around rounded-t-[18px] bg-card/98 backdrop-blur-xl border-t border-x border-border/10 shadow-fintech-nav px-1 py-2 min-h-[52px] lg:min-h-[64px]">
          {navItems.map((item) => {
            if (item.path === "__menu__") {
              return (
                <button
                  key="menu"
                  onClick={handleMenuClick}
                  className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 min-w-[50px] text-muted-foreground/55 hover:text-muted-foreground"
                >
                  <Menu className="h-[19px] w-[19px]" strokeWidth={1.5} />
                  <span className="text-[9px] tracking-wide font-medium">Menu</span>
                </button>
              );
            }

            if (item.path === "__fab__") {
              return (
                <button
                  key="fab"
                  onClick={handleFabClick}
                  className="relative -mt-6 flex items-center justify-center"
                >
                  <motion.div
                    whileTap={{ scale: 0.92 }}
                    className="h-12 w-12 rounded-full flex items-center justify-center border-4 border-card"
                    style={{ backgroundColor: "hsl(var(--brand-highlight))" }}
                  >
                    <Plus className="h-5 w-5 text-white" strokeWidth={2.5} />
                  </motion.div>
                </button>
              );
            }

            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 min-w-[50px]",
                  active ? "text-[hsl(var(--brand-deep))]" : "text-muted-foreground/55 hover:text-muted-foreground"
                )}
              >
                <item.icon
                  className="h-[19px] w-[19px] transition-all duration-200"
                  strokeWidth={active ? 2.2 : 1.5}
                />
                <span className={cn("text-[9px] tracking-wide transition-all", active ? "font-semibold" : "font-medium")}>
                  {item.label}
                </span>
                {active && (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="h-0.5 w-4 rounded-full mt-0.5"
                    style={{ backgroundColor: "hsl(var(--brand-highlight))" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
