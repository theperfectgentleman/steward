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
    <div className="flex min-h-dvh">
      <SidebarNav role={user.role} />
      <div className="flex flex-col flex-1 min-w-0 pb-20 lg:pb-0">
        <TopBar />
        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-5 w-full max-w-[1600px] mx-auto">
          {children}
        </main>
        <BottomNav role={user.role} />
        <WorkFab />
      </div>
    </div>
  );
}
