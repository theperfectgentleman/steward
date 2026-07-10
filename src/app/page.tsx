"use client";

import { AuthGate } from "@/components/AuthGate";
import { HomeRedirect } from "@/components/CommitteeGuard";
import { OverallDashboardView } from "@/components/views/OverallDashboardView";

export default function HomePage() {
  return (
    <AuthGate>
      <HomeRedirect />
      <OverallDashboardView />
    </AuthGate>
  );
}
