"use client";

import { useEffect, useState } from "react";
import { Download, MonitorSmartphone, Share } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { TouchButton } from "@/components/TouchButton";
import {
  getInstallMode,
  initPwaInstallListeners,
  installHintCopy,
  promptPwaInstall,
  subscribeInstallAvailability,
  type InstallMode,
} from "@/lib/pwa";

export function PwaInstallInit() {
  useEffect(() => {
    initPwaInstallListeners();
  }, []);
  return null;
}

export function InstallAppPrompt({ className = "" }: { className?: string }) {
  const [mode, setMode] = useState<InstallMode>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    initPwaInstallListeners();
    const sync = () => setMode(getInstallMode());
    sync();
    return subscribeInstallAvailability(sync);
  }, []);

  const copy = installHintCopy(mode);
  if (!mode || !copy || done) return null;

  const canPrompt = mode === "chromium";
  const Icon =
    mode === "ios" ? Share : mode === "safari-mac" ? MonitorSmartphone : Download;

  const onInstall = async () => {
    if (!canPrompt) return;
    setBusy(true);
    try {
      const outcome = await promptPwaInstall();
      if (outcome === "accepted") setDone(true);
      setMode(getInstallMode());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`rounded-3xl border-2 border-charcoal/10 bg-white/80 backdrop-blur-sm p-5 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface border border-charcoal/8">
          <BrandLogo size={36} />
        </div>
        <div className="min-w-0 flex-1 space-y-1 pt-0.5">
          <p className="text-sm font-semibold text-charcoal">{copy.title}</p>
          <p className="text-sm text-muted leading-relaxed">{copy.body}</p>
        </div>
      </div>

      {canPrompt ? (
        <TouchButton
          variant="ghost"
          size="md"
          className="w-full mt-4 border-charcoal/15"
          disabled={busy}
          onClick={onInstall}
        >
          <Download className="h-4 w-4" strokeWidth={2.25} />
          {busy ? "Adding…" : copy.cta}
        </TouchButton>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-charcoal/80">
          <Icon className="h-4 w-4 shrink-0 text-primary-dark" strokeWidth={2.25} />
          <span>
            {mode === "ios" && "Open the Share sheet, then choose Add to Home Screen."}
            {mode === "safari-mac" && "Safari menu: File → Add to Dock…"}
            {mode === "manual" && "Look for the install icon in your browser’s address bar."}
          </span>
        </div>
      )}
    </div>
  );
}
