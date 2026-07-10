"use client";

import { BottomNav } from "./BottomNav";
import { CommitteeSwitcher } from "./CommitteeSwitcher";
import { useApp } from "@/providers/AppProvider";
import { LogOut } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useApp();

  if (!user) return <>{children}</>;

  return (
    <div className="flex flex-col min-h-dvh pb-20">
      <header className="sticky top-0 z-30 bg-white border-b border-charcoal/10 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-accent uppercase tracking-wider">
              UnityCommit
            </p>
            <CommitteeSwitcher />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-charcoal truncate max-w-[120px]">
                {user.name}
              </p>
              <p className="text-xs text-muted capitalize">
                {user.role.replace(/_/g, " ").toLowerCase()}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="touch-target flex items-center justify-center rounded-xl bg-surface border border-charcoal/10"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5 text-muted" />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 px-4 py-5 max-w-5xl mx-auto w-full">{children}</main>
      <BottomNav role={user.role} />
    </div>
  );
}
