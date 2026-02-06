import { ReactNode, useState, useCallback } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { useIsMobile } from "@/hooks/use-mobile";

const SIDEBAR_STORAGE_KEY = "sidebar-mode";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const isMobile = useIsMobile();

  // Read persisted sidebar state from localStorage
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored !== null) return stored === "expanded";
    } catch {}
    return !isMobile;
  });

  // Persist sidebar state changes to localStorage
  const handleSidebarChange = useCallback((open: boolean) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? "expanded" : "collapsed");
    } catch {}
  }, []);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-1 flex-col min-w-0">
          <AppHeader title={title} />
          <main className="flex-1 overflow-auto p-3 md:p-4 lg:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
