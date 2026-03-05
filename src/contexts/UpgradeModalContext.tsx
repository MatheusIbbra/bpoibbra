import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from "react";
import { trackEvent } from "@/lib/analytics";
import { useBaseFilterState } from "@/contexts/BaseFilterContext";

const STAFF_ROLES = ["admin", "supervisor", "fa", "kam", "projetista"];

type UpgradeTrigger = "transactions" | "ai" | "connections" | "forecast" | "simulator" | "anomaly" | "general";

interface UpgradeModalState {
  isOpen: boolean;
  trigger: UpgradeTrigger;
  openUpgradeModal: (trigger?: UpgradeTrigger) => void;
  closeUpgradeModal: () => void;
}

const UpgradeModalContext = createContext<UpgradeModalState | undefined>(undefined);

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [trigger, setTrigger] = useState<UpgradeTrigger>("general");
  const { userRole } = useBaseFilterState();
  const isStaff = userRole !== null && STAFF_ROLES.includes(userRole);

  const openUpgradeModal = useCallback((t: UpgradeTrigger = "general") => {
    // Never show upgrade modal to staff users
    if (isStaff) return;
    trackEvent("upgrade_modal_opened", { trigger: t });
    setTrigger(t);
    setIsOpen(true);
  }, [isStaff]);

  // Listen for custom events from non-React code (error-handler, etc.)
  useEffect(() => {
    const handler = (e: CustomEvent) => openUpgradeModal(e.detail?.trigger || "general");
    window.addEventListener("open-upgrade-modal", handler as EventListener);
    return () => window.removeEventListener("open-upgrade-modal", handler as EventListener);
  }, [openUpgradeModal]);

  const closeUpgradeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(() => ({
    isOpen: isStaff ? false : isOpen, trigger, openUpgradeModal, closeUpgradeModal,
  }), [isOpen, isStaff, trigger, openUpgradeModal, closeUpgradeModal]);

  return (
    <UpgradeModalContext.Provider value={value}>
      {children}
    </UpgradeModalContext.Provider>
  );
}

export function useUpgradeModal() {
  const context = useContext(UpgradeModalContext);
  if (!context) {
    throw new Error("useUpgradeModal must be used within UpgradeModalProvider");
  }
  return context;
}
