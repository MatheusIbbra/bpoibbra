import { ReactNode, useState, useCallback, useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileMenuScreen } from "./MobileMenuScreen";
import { MobileFabMenu } from "./MobileFabMenu";
import { BrandBackground } from "./BrandBackground";
import { AIAssistantChat } from "@/components/ai/AIAssistantChat";
import { useIsMobileOrTablet } from "@/hooks/use-breakpoint";
import { useBaseFilter, useBaseFilterState } from "@/contexts/BaseFilterContext";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useOpenFinanceLoginToast } from "@/hooks/useOpenFinanceStatus";
import { BaseSelectorEnhanced } from "./BaseSelectorEnhanced";

const SIDEBAR_STORAGE_KEY = "sidebar-mode";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const isMobile = useIsMobileOrTablet();
  const { user } = useAuth();
  const { availableOrganizations, isLoading: baseLoading, userRole } = useBaseFilterState();
  useOpenFinanceLoginToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);

  useEffect(() => {
    const menuHandler = () => setMobileMenuOpen(prev => !prev);
    const fabHandler = () => setFabMenuOpen(prev => !prev);
    window.addEventListener("ibbra:mobile-menu-toggle", menuHandler);
    window.addEventListener("ibbra:fab-toggle", fabHandler);
    return () => {
      window.removeEventListener("ibbra:mobile-menu-toggle", menuHandler);
      window.removeEventListener("ibbra:fab-toggle", fabHandler);
    };
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (isMobile) return false;
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) return stored === "expanded";
    } catch {}
    return true;
  });

  const handleSidebarChange = useCallback((open: boolean) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? "expanded" : "collapsed");
    } catch {}
  }, []);

  const isStaffRole = userRole && ["admin", "supervisor", "fa", "kam", "projetista"].includes(userRole);
  const hasNoBases = !baseLoading && user && availableOrganizations.length === 0 && !isStaffRole;

  // Mobile layout — premium fintech app experience
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <MobileHeader />

        {/* Base selector */}
        <div className="px-5 pb-4 max-w-[420px] mx-auto w-full">
          <BaseSelectorEnhanced />
        </div>

        <main className="flex-1 w-full max-w-[420px] mx-auto px-5 pb-28 space-y-6 overflow-x-hidden">
          {baseLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : hasNoBases ? (
            <div className="flex items-center justify-center py-20">
              <Alert variant="destructive" className="max-w-md rounded-[20px]">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Acesso restrito</AlertTitle>
                <AlertDescription>
                  Nenhuma base vinculada ao seu cadastro. Entre em contato com seu administrador.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            children
          )}
        </main>

        <MobileBottomNav />
        <MobileMenuScreen onClose={() => setMobileMenuOpen(false)} isOpen={mobileMenuOpen} />
        <MobileFabMenu isOpen={fabMenuOpen} onClose={() => setFabMenuOpen(false)} />
        <AIAssistantChat isPaidUser={false} />
      </div>
    );
  }

  // Desktop layout — sidebar experience
  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
      <BrandBackground />
      <AppSidebar />
      <SidebarInset className="flex flex-1 flex-col min-w-0 relative z-[1]">
        <AppHeader title={title} />
        <main className="flex-1 w-full overflow-auto p-6 lg:p-8 xl:p-10">
          {baseLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : hasNoBases ? (
            <div className="flex items-center justify-center py-20">
              <Alert variant="destructive" className="max-w-md rounded-[20px]">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Acesso restrito</AlertTitle>
                <AlertDescription>
                  Nenhuma base vinculada ao seu cadastro. Entre em contato com seu administrador.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            children
          )}
        </main>
      </SidebarInset>
      <AIAssistantChat isPaidUser={false} />
    </SidebarProvider>
  );
}
