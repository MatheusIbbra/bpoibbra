import { useLocation, useNavigate } from "react-router-dom";
import { Home, CreditCard, Target, Plus, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { motion } from "framer-motion";
import { MobileMenuScreen } from "./MobileMenuScreen";

const navItems = [
  { label: "Visão", icon: Home, path: "/" },
  { label: "Cartões", icon: CreditCard, path: "/cartoes" },
  { label: "", icon: Plus, path: "__fab__" },
  { label: "Orçamentos", icon: Target, path: "/orcamentos" },
  { label: "Menu", icon: Menu, path: "__more__" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const handleFabClick = () => {
    window.dispatchEvent(new CustomEvent("ibbra:fab-toggle"));
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="mx-auto max-w-[420px] px-2 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around rounded-t-[18px] bg-card/98 backdrop-blur-xl border-t border-x border-border/10 shadow-fintech-nav px-1 py-2">
            {navItems.map((item) => {
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

              if (item.path === "__more__") {
                return (
                  <Sheet key="more" open={moreOpen} onOpenChange={setMoreOpen}>
                    <SheetTrigger asChild>
                      <button className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all duration-200 text-muted-foreground/60 hover:text-muted-foreground">
                        <item.icon className="h-[19px] w-[19px]" strokeWidth={1.5} />
                        <span className="text-[9px] font-medium tracking-wide">{item.label}</span>
                      </button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-[24px] max-h-[90vh] h-[90vh] p-0 border-0">
                      <SheetTitle className="sr-only">Menu</SheetTitle>
                      <MobileMenuScreen onClose={() => setMoreOpen(false)} />
                    </SheetContent>
                  </Sheet>
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
    </>
  );
}
