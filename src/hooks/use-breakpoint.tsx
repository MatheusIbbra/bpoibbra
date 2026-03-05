import * as React from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

const TABLET_MIN = 768;
const DESKTOP_MIN = 1024;

export function useBreakpoint(): Breakpoint {
  const getBreakpoint = (): Breakpoint => {
    const w = window.innerWidth;
    if (w < TABLET_MIN) return "mobile";
    if (w < DESKTOP_MIN) return "tablet";
    return "desktop";
  };

  const [breakpoint, setBreakpoint] = React.useState<Breakpoint>(() => getBreakpoint());

  React.useEffect(() => {
    const onChange = () => setBreakpoint(getBreakpoint());
    const mql = window.matchMedia(`(max-width: ${DESKTOP_MIN - 1}px)`);
    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
    };
  }, []);

  return breakpoint;
}

export function useIsMobile(): boolean {
  return useBreakpoint() === "mobile";
}

export function useIsTablet(): boolean {
  return useBreakpoint() === "tablet";
}

export function useIsMobileOrTablet(): boolean {
  const b = useBreakpoint();
  return b === "mobile" || b === "tablet";
}
