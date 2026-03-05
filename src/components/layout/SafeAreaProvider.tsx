import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Ensures Android navigation bar doesn't overlap content.
 * Sets CSS custom properties for safe area insets on Android.
 */
export function useAndroidSafeArea() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;

    // Force viewport-fit=cover for Android
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      const content = viewport.getAttribute("content") || "";
      if (!content.includes("viewport-fit=cover")) {
        viewport.setAttribute("content", content + ", viewport-fit=cover");
      }
    }
  }, []);
}
