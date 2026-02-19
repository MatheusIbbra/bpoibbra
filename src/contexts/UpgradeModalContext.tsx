import { createContext, useContext, useState, ReactNode, useCallback } from "react";

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
    setTrigger(t);
    setIsOpen(true);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <UpgradeModalContext.Provider value={{ isOpen, trigger, openUpgradeModal, closeUpgradeModal }}>
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
