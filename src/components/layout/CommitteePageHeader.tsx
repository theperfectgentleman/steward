"use client";

import { CommitteeWorkspaceTabs } from "./CommitteeWorkspaceTabs";
import { parseCommitteeId } from "@/lib/navigation";
import { usePathname } from "next/navigation";

export function CommitteePageHeader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const committeeId = parseCommitteeId(pathname);

  return (
    <div className="space-y-4">
      {committeeId && <CommitteeWorkspaceTabs />}
      {children}
    </div>
  );
}
