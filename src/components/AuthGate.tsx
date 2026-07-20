"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/providers/AppProvider";
import { AppShell } from "@/components/AppShell";
import { LoginPicker } from "@/components/LoginPicker";
import { OrgPickerLanding } from "@/components/OrgPickerLanding";
import { PageLoader } from "@/components/loading/PageShimmer";
import {
  dismissBootSplash,
  getLogoEntranceMs,
  isStandalonePwa,
} from "@/lib/splash";

let entranceAnimationPlayed = false;

export function AuthGate({
  children,
  requireOrg = true,
}: {
  children: React.ReactNode;
  requireOrg?: boolean;
}) {
  const { user, loading } = useApp();
  const [entranceDone, setEntranceDone] = useState(entranceAnimationPlayed);

  useEffect(() => {
    document.documentElement.setAttribute("data-splash-owned", "1");
    return () => document.documentElement.removeAttribute("data-splash-owned");
  }, []);

  useEffect(() => {
    if (entranceAnimationPlayed) {
      setEntranceDone(true);
      return;
    }
    const base = getLogoEntranceMs();
    const ms = isStandalonePwa() ? base + 280 : base;
    const timer = window.setTimeout(() => {
      entranceAnimationPlayed = true;
      setEntranceDone(true);
    }, ms);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !entranceDone) return;
    dismissBootSplash();
  }, [loading, entranceDone]);

  if (loading || !entranceDone) {
    return (
      <div
        className="min-h-dvh bg-surface"
        aria-busy="true"
        aria-label="Loading Steward"
      >
        <PageLoader label={loading ? "Signing in…" : "Loading Steward…"} />
      </div>
    );
  }

  if (!user) return <LoginPicker />;

  if (requireOrg && !user.activeOrganizationId) {
    return <OrgPickerLanding />;
  }

  return <AppShell>{children}</AppShell>;
}
