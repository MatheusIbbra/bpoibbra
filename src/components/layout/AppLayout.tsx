import { ReactNode, useState, useCallback } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { BrandBackground } from "./BrandBackground";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useOpenFinanceLoginToast } from "@/hooks/useOpenFinanceStatus";

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
    return !isMobile;
  });

  const handleSidebarChange = useCallback((open: boolean) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? "expanded" : "collapsed");
    } catch {}
  }, []);

  const hasNoBases = !baseLoading && user && availableOrganizations.length === 0;

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
      <BrandBackground />
      <AppSidebar />
      <SidebarInset className="flex flex-1 flex-col min-w-0 relative z-[1]">
        <AppHeader title={title} />
        <main className="flex-1 w-full overflow-auto p-4 md:p-6 lg:p-8 xl:p-10">
          {baseLoading ?
          <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div> :
          hasNoBases ?
          <div className="flex items-center justify-center py-20">
              <Alert variant="destructive" className="max-w-md">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Acesso restrito</AlertTitle>
                <AlertDescription>
                  Nenhuma base vinculada ao seu cadastro. Entre em contato com seu administrador para liberar o acesso.
                </AlertDescription>
              </Alert>
            </div> :

          children
          }
        </main>
      </SidebarInset>
    </SidebarProvider>);

}