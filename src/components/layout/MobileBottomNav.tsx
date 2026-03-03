import { useLocation, useNavigate } from "react-router-dom";
import { Home, CreditCard, BarChart3, Plus, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "./AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Cartões", icon: CreditCard, path: "/cartoes" },
  { label: "", icon: Plus, path: "__fab__" },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { label: "Mais", icon: Menu, path: "__more__" },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  // FAB click dispatches custom event to open the quick actions menu
  const handleFabClick = () => {
    window.dispatchEvent(new CustomEvent("ibbra:fab-toggle"));
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="mx-auto max-w-[420px] px-2 pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around rounded-t-[24px] bg-card/95 backdrop-blur-2xl border-t border-x border-border/20 shadow-fintech-nav px-2 py-2">
            {navItems.map((item) => {
              // FAB center button
              if (item.path === "__fab__") {
                return (
                  <button
                    key="fab"
                    onClick={handleFabClick}
                    className="relative -mt-7 flex items-center justify-center"
                  >
                    <motion.div
                      whileTap={{ scale: 0.9 }}
                      className="h-14 w-14 rounded-full bg-primary shadow-lg shadow-primary/30 flex items-center justify-center border-4 border-card"
                    >
                      <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2.5} />
                    </motion.div>
                  </button>
                );
              }

              // "Mais" opens sidebar sheet
              if (item.path === "__more__") {
                return (
                  <Sheet key="more" open={moreOpen} onOpenChange={setMoreOpen}>
                    <SheetTrigger asChild>
                      <button
                        className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-300 text-muted-foreground"
                      >
                        <item.icon className="h-5 w-5" strokeWidth={1.8} />
                        <span className="text-[10px] font-medium">{item.label}</span>
                      </button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-[24px] max-h-[85vh] p-0 border-0">
                      <SidebarProvider defaultOpen>
                        <div className="w-full overflow-y-auto">
                          <div className="mx-auto w-10 h-1 rounded-full bg-muted-foreground/20 mt-3 mb-2" />
                          <AppSidebar />
                        </div>
                      </SidebarProvider>
                    </SheetContent>
                  </Sheet>
                );
              }

              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    if (item.path === "/relatorios") {
                      // Navigate to reports hub (no tab = card selection)
                      navigate("/relatorios");
                    } else {
                      navigate(item.path);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-300 min-w-[52px]",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn("h-5 w-5 transition-all duration-300", active && "scale-110")}
                    strokeWidth={active ? 2.2 : 1.8}
                  />
                  <span className={cn("text-[10px] font-medium", active && "font-semibold")}>
                    {item.label}
                  </span>
                  {active && (
                    <motion.div
                      layoutId="bottomNavIndicator"
                      className="h-1 w-5 rounded-full bg-primary mt-0.5"
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
