"use client";

import { CommitteeWorkspaceTabs } from "@/components/layout/CommitteeWorkspaceTabs";

/** Shared chrome for committee routes: section tabs + page body. */
export function CommitteePageHeader({
  children,
  showTabs = true,
  /** When true, tabs are not rendered here — the child view places them under its title. */
  tabsAfterTitle = false,
}: {
  children: React.ReactNode;
  showTabs?: boolean;
  tabsAfterTitle?: boolean;
}) {
  if (!showTabs || tabsAfterTitle) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4">
      <CommitteeWorkspaceTabs />
      {children}
    </div>
  );
}
