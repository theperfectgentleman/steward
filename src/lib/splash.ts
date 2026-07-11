/** Keep in sync with `.logo-entrance` duration in globals.css */
export const LOGO_ENTRANCE_MS = 1900;
export const LOGO_ENTRANCE_REDUCED_MS = 350;

export const BOOT_SPLASH_ID = "boot-splash";
export const BOOT_SPLASH_DISMISS_EVENT = "steward-dismiss-splash";

export function getLogoEntranceMs(): number {
  if (typeof window === "undefined") return LOGO_ENTRANCE_MS;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? LOGO_ENTRANCE_REDUCED_MS
    : LOGO_ENTRANCE_MS;
}

export function dismissBootSplash() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOT_SPLASH_DISMISS_EVENT));
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    nav.standalone === true
  );
}
