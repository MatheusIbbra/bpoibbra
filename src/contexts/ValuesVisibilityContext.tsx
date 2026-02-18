import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

interface ValuesVisibilityContextType {
  showValues: boolean;
  toggleValues: () => void;
}

const ValuesVisibilityContext = createContext<ValuesVisibilityContextType>({
  showValues: true,
  toggleValues: () => {},
});

export function ValuesVisibilityProvider({ children }: { children: ReactNode }) {
  const [showValues, setShowValues] = useState(() => {
    try {
      const stored = localStorage.getItem("show-values");
      return stored !== "false";
    } catch {
      return true;
    }
  });

  const toggleValues = useCallback(() => {
    setShowValues((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("show-values", String(next));
      } catch {}
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ showValues, toggleValues }),
    [showValues, toggleValues]
  );

  return (
    <ValuesVisibilityContext.Provider value={contextValue}>
      {children}
    </ValuesVisibilityContext.Provider>
  );
}

export function useValuesVisibility() {
  return useContext(ValuesVisibilityContext);
}

/** Utility: blur a value string if hidden */
export function MaskedValue({ children, className }: { children: React.ReactNode; className?: string }) {
  const { showValues } = useValuesVisibility();
  if (!showValues) {
    return <span className={`select-none blur-md ${className || ""}`}>{children}</span>;
  }
  return <>{children}</>;
}
