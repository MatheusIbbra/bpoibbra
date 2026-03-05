import * as React from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

const TABLET_MIN = 768;
const DESKTOP_MIN = 1024;

function deriveBreakpoint(mqlMobile: MediaQueryList, mqlTablet: MediaQueryList): Breakpoint {
  if (mqlMobile.matches) return "mobile";
  if (mqlTablet.matches) return "tablet";
  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = React.useState<Breakpoint>(() => {
    const mqlMobile = window.matchMedia(`(max-width: ${TABLET_MIN - 1}px)`);
    const mqlTablet = window.matchMedia(`(max-width: ${DESKTOP_MIN - 1}px)`);
    return deriveBreakpoint(mqlMobile, mqlTablet);
  });

  React.useEffect(() => {
    const mqlMobile = window.matchMedia(`(max-width: ${TABLET_MIN - 1}px)`);
    const mqlTablet = window.matchMedia(`(max-width: ${DESKTOP_MIN - 1}px)`);

    const onChange = () => setBreakpoint(deriveBreakpoint(mqlMobile, mqlTablet));

    mqlMobile.addEventListener("change", onChange);
    mqlTablet.addEventListener("change", onChange);

    return () => {
      mqlMobile.removeEventListener("change", onChange);
      mqlTablet.removeEventListener("change", onChange);
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
