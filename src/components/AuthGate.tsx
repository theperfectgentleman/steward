"use client";

import { useApp } from "@/providers/AppProvider";
import { AppShell } from "@/components/AppShell";
import { LoginPicker } from "@/components/LoginPicker";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  if (!user) return <LoginPicker />;

  return <AppShell>{children}</AppShell>;
}
