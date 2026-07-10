"use client";

import { useApp } from "@/providers/AppProvider";
import { AppShell } from "@/components/AppShell";
import { LoginPicker } from "@/components/LoginPicker";
import { DashboardView } from "@/components/views/DashboardView";

export default function HomePage() {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  if (!user) return <LoginPicker />;

  return (
    <AppShell>
      <DashboardView />
    </AppShell>
  );
}
