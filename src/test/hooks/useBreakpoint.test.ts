import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBreakpoint, useIsMobile, useIsTablet, useIsMobileOrTablet } from "@/hooks/use-breakpoint";

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

describe("useBreakpoint", () => {
  afterEach(() => {
    setWindowWidth(1024);
  });

  it("returns 'mobile' when innerWidth is 375", () => {
    setWindowWidth(375);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("mobile");
  });

  it("returns 'tablet' when innerWidth is 768", () => {
    setWindowWidth(768);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("tablet");
  });

  it("returns 'desktop' when innerWidth is 1024", () => {
    setWindowWidth(1024);
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toBe("desktop");
  });
});

describe("useIsMobile", () => {
  it("returns false on tablet", () => {
    setWindowWidth(768);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("returns true on mobile", () => {
    setWindowWidth(375);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });
});

describe("useIsTablet", () => {
  it("returns true on tablet", () => {
    setWindowWidth(768);
    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });
});

describe("useIsMobileOrTablet", () => {
  it("returns true on tablet", () => {
    setWindowWidth(900);
    const { result } = renderHook(() => useIsMobileOrTablet());
    expect(result.current).toBe(true);
  });

  it("returns false on desktop", () => {
    setWindowWidth(1280);
    const { result } = renderHook(() => useIsMobileOrTablet());
    expect(result.current).toBe(false);
  });
});
