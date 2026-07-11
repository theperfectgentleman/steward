"use client";

import { useEffect, useState } from "react";
import {
  BOOT_SPLASH_DISMISS_EVENT,
} from "@/lib/splash";

type Phase = "visible" | "exiting" | "hidden";

export function BootSplash() {
  const [phase, setPhase] = useState<Phase>("visible");

  useEffect(() => {
    const dismiss = () => {
      setPhase((current) => (current === "visible" ? "exiting" : current));
    };
    window.addEventListener(BOOT_SPLASH_DISMISS_EVENT, dismiss);
    return () => window.removeEventListener(BOOT_SPLASH_DISMISS_EVENT, dismiss);
  }, []);

  useEffect(() => {
    if (phase !== "exiting") return;
    const timer = window.setTimeout(() => setPhase("hidden"), 280);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (phase === "hidden") return null;

  return (
    <div
      id="boot-splash"
      className={`boot-splash${phase === "exiting" ? " boot-splash-exit" : ""}`}
      aria-hidden={phase === "exiting"}
    >
      <div className="boot-splash-mark">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-mark.png"
          alt=""
          width={132}
          height={132}
          className="logo-entrance"
          decoding="async"
        />
      </div>
      <p className="boot-splash-brand">Steward</p>
    </div>
  );
}
