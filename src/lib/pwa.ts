import { isStandalonePwa } from "@/lib/splash";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type InstallMode =
  | "chromium" // Chrome / Edge / Brave — native install prompt
  | "safari-mac" // Safari on macOS — Add to Dock
  | "ios" // iPhone / iPad — Add to Home Screen
  | "manual" // Show browser chrome install hint
  | null; // Already installed / not relevant

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function subscribeInstallAvailability(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function initPwaInstallListeners() {
  if (typeof window === "undefined") return;
  if ((window as Window & { __stewardPwaInit?: boolean }).__stewardPwaInit) return;
  (window as Window & { __stewardPwaInit?: boolean }).__stewardPwaInit = true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const promptEvent = deferredPrompt;
  if (!promptEvent) return "unavailable";
  deferredPrompt = null;
  notify();
  await promptEvent.prompt();
  const { outcome } = await promptEvent.userChoice;
  return outcome;
}

function isIosDevice() {
  const ua = window.navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS reports as Mac with touch
  return (
    window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1
  );
}

function isSafariBrowser() {
  const ua = window.navigator.userAgent;
  return /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|opr|vivaldi/i.test(ua);
}

function isMacDesktop() {
  return /Mac/.test(window.navigator.platform) && window.navigator.maxTouchPoints <= 1;
}

function isLinuxDesktop() {
  const platform = window.navigator.platform || "";
  const ua = window.navigator.userAgent;
  // Exclude Android (also Linux in UA)
  if (/android/i.test(ua)) return false;
  return /linux/i.test(platform) || /linux/i.test(ua) || /cros/i.test(ua);
}

function isWindowsDesktop() {
  const platform = window.navigator.platform || "";
  const ua = window.navigator.userAgent;
  return /win/i.test(platform) || /windows/i.test(ua);
}

function isChromiumFamily() {
  return /chrome|chromium|edg|brave|opr|vivaldi/i.test(window.navigator.userAgent);
}

type DesktopOs = "windows" | "mac" | "linux" | "chromeos" | "unknown";

function getDesktopOs(): DesktopOs {
  const ua = window.navigator.userAgent;
  if (/cros/i.test(ua)) return "chromeos";
  if (isWindowsDesktop()) return "windows";
  if (isMacDesktop()) return "mac";
  if (isLinuxDesktop()) return "linux";
  return "unknown";
}

function desktopInstallTarget(os: DesktopOs): string {
  switch (os) {
    case "windows":
      return "your desktop or Start menu";
    case "mac":
      return "your Applications folder or Dock";
    case "linux":
      return "your app launcher or desktop";
    case "chromeos":
      return "your Chromebook shelf";
    default:
      return "your computer";
  }
}

/** How to offer install on this client (Windows, Mac, Linux, ChromeOS, iOS, etc.). */
export function getInstallMode(): InstallMode {
  if (typeof window === "undefined") return null;
  if (isStandalonePwa()) return null;
  if (deferredPrompt) return "chromium";
  if (isIosDevice()) return "ios";
  if (isSafariBrowser() && isMacDesktop()) return "safari-mac";
  // Chromium on Windows / Mac / Linux / ChromeOS may fire beforeinstallprompt later.
  if (isChromiumFamily()) return "manual";
  return "manual";
}

export function installHintCopy(
  mode: InstallMode,
): { title: string; body: string; cta: string } | null {
  const os = typeof window !== "undefined" ? getDesktopOs() : "unknown";
  const target = desktopInstallTarget(os);

  switch (mode) {
    case "chromium":
      return {
        title: "Add Steward to your desktop",
        body: `Keep committee work one click away — add Steward to ${target}.`,
        cta: os === "chromeos" ? "Add to shelf" : "Add to desktop",
      };
    case "manual":
      return {
        title: "Add Steward to your desktop",
        body: `Works on Windows, Mac, and Linux. Add Steward to ${target} from your browser.`,
        cta: "Add to desktop",
      };
    case "safari-mac":
      return {
        title: "Add Steward to your Mac",
        body: "Open it from the Dock anytime, like a native app.",
        cta: "Add to Dock",
      };
    case "ios":
      return {
        title: "Add Steward to your phone",
        body: "Keep it on your Home Screen for a full-screen app experience.",
        cta: "Add to Home Screen",
      };
    default:
      return null;
  }
}
