"use client";

/** Legacy wrapper — committee workspace tabs removed (five-peer IA). */
export function CommitteePageHeader({
  children,
}: {
  children: React.ReactNode;
  showTabs?: boolean;
  tabsAfterTitle?: boolean;
}) {
  return <>{children}</>;
}
