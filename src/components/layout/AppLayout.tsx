import { ReactNode, useState, useCallback } from "react";
import { IconSidebar } from "./IconSidebar";
import { MainSidebar } from "./MainSidebar";
import { DesktopTopBar } from "./DesktopTopBar";
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
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) return stored === "expanded";
    } catch {}
    return true;
  });

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "expanded" : "collapsed");
      } catch {}
      return next;
    });
  }, []);

  const hasNoBases = !baseLoading && user && availableOrganizations.length === 0;

  const renderContent = () => {
    if (baseLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (hasNoBases) {
      return (
        <div className="flex items-center justify-center py-20">
          <Alert variant="destructive" className="max-w-md rounded-[20px]">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Acesso restrito</AlertTitle>
            <AlertDescription>
              Nenhuma base vinculada ao seu cadastro. Entre em contato com seu administrador.
            </AlertDescription>
          </Alert>
        </div>
      );
    }
    return children;
  };

  // Mobile layout
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <MobileHeader />
        <div className="px-5 pb-4 max-w-[420px] mx-auto w-full">
          <BaseSelectorEnhanced />
        </div>
        <main className="flex-1 w-full max-w-[420px] mx-auto px-5 pb-28 space-y-6 overflow-x-hidden">
          {renderContent()}
        </main>
        <MobileBottomNav />
        <AIAssistantChat isPaidUser={false} />
      </div>
    );
  }

  // Desktop layout — Icon Sidebar + Main Sidebar + TopBar
  return (
    <div className="min-h-screen bg-background">
      <BrandBackground />
      <IconSidebar />
      <MainSidebar open={sidebarOpen} />

      {/* Main area: offset by icon sidebar (64px) + main sidebar when open (240px) */}
      <div
        className="relative z-[1] flex flex-col min-h-screen transition-all duration-300 ease-in-out"
        style={{ marginLeft: sidebarOpen ? "304px" : "64px" }}
      >
        <DesktopTopBar sidebarOpen={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        <main className="flex-1 w-full overflow-auto p-6 lg:p-8 xl:p-10">
          {renderContent()}
        </main>
      </div>

      <AIAssistantChat isPaidUser={false} />
    </div>
  );
}
