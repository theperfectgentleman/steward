"use client";

import { SidebarNav } from "./layout/SidebarNav";
import { TopBar } from "./layout/TopBar";
import { BottomNav } from "./BottomNav";
import { WorkFab } from "./WorkFab";
import { useApp } from "@/providers/AppProvider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useApp();

  if (!user) return <>{children}</>;

  return (
    <div className="flex min-h-dvh bg-surface">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col pb-20 lg:pb-0">
        <TopBar />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-3 lg:px-5 lg:py-4">
          {children}
        </main>
        <BottomNav />
        <WorkFab />
      </div>
    </div>
  );
}
