"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import {
  committeePath,
  isCommitteeRoute,
  parseCommitteeId,
  parseCommitteeSection,
} from "@/lib/navigation";
import { CommitteeSwitcher } from "@/components/CommitteeSwitcher";

const SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  tasks: "Tasks",
  schedule: "Schedule",
  minutes: "Minutes",
};

export function TopBar() {
  const pathname = usePathname();
  const { user } = useApp();
  const committeeId = parseCommitteeId(pathname);
  const { committee } = useCommitteeContext();
  const section = isCommitteeRoute(pathname)
    ? parseCommitteeSection(pathname)
    : null;

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-charcoal/10 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <nav className="hidden lg:flex items-center gap-1 text-sm text-muted mb-1" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-charcoal font-medium">
              Overall
            </Link>
            {committee && (
              <>
                <ChevronRight className="h-4 w-4 shrink-0" />
                <Link
                  href={committeePath(committee.id)}
                  className="hover:text-charcoal font-medium truncate max-w-[200px]"
                >
                  {committee.name}
                </Link>
              </>
            )}
            {section && section !== "overview" && (
              <>
                <ChevronRight className="h-4 w-4 shrink-0" />
                <span className="text-charcoal font-semibold">
                  {SECTION_LABELS[section]}
                </span>
              </>
            )}
          </nav>
          <div className="lg:hidden">
            <p className="text-xs font-bold text-accent uppercase tracking-wider">
              UnityCommit
            </p>
            <CommitteeSwitcher />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-charcoal truncate max-w-[140px]">
              {user.name}
            </p>
            <p className="text-xs text-muted capitalize">
              {user.role.replace(/_/g, " ").toLowerCase()}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal text-white font-bold text-sm">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)}
          </span>
        </div>
      </div>
    </header>
  );
}
