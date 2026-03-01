import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from "react";
import { trackEvent } from "@/lib/analytics";

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

  const openUpgradeModal = useCallback((t: UpgradeTrigger = "general") => {
    trackEvent("upgrade_modal_opened", { trigger: t });
    setTrigger(t);
    setIsOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo(() => ({
    isOpen, trigger, openUpgradeModal, closeUpgradeModal,
  }), [isOpen, trigger, openUpgradeModal, closeUpgradeModal]);

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
