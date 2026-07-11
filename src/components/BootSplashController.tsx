"use client";

import { useEffect } from "react";
import {
  dismissBootSplash,
  getLogoEntranceMs,
  isStandalonePwa,
} from "@/lib/splash";

/**
 * Dismisses the SSR boot splash on routes that don't use AuthGate (e.g. invite).
 * AuthGate owns dismissal when present via `data-splash-owned`.
 */
export function BootSplashController() {
  useEffect(() => {
    const ms = getLogoEntranceMs() + (isStandalonePwa() ? 280 : 0) + 120;
    const timer = window.setTimeout(() => {
      if (!document.documentElement.hasAttribute("data-splash-owned")) {
        dismissBootSplash();
      }
    }, ms);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
