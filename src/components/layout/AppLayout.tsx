import { ReactNode, useState, useCallback } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { BrandBackground } from "./BrandBackground";
import { AIAssistantChat } from "@/components/ai/AIAssistantChat";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
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
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { availableOrganizations, isLoading: baseLoading } = useBaseFilter();
  useOpenFinanceLoginToast();

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

  const hasNoBases = !baseLoading && user && availableOrganizations.length === 0;

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
