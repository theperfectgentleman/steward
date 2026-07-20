"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  committeePath,
  parseCommitteeId,
  parseCommitteeSection,
} from "@/lib/navigation";

const TABS = [
  { key: "tasks", label: "Task Board", section: "tasks" as const },
  { key: "projects", label: "Projects", section: "projects" as const },
  { key: "assignments", label: "Assignments", section: "assignments" as const },
  { key: "schedule", label: "Schedule", section: "schedule" as const },
  { key: "documents", label: "Documents", section: "documents" as const },
];

export function CommitteeWorkspaceTabs() {
  const pathname = usePathname();
  const committeeId = parseCommitteeId(pathname);
  if (!committeeId) return null;

  const current = parseCommitteeSection(pathname);

  return (
    <nav
      className="flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-charcoal/[0.04] p-1"
      aria-label="Committee sections"
    >
      {TABS.map((tab) => {
        const href = committeePath(committeeId, tab.section);
        const active = current === tab.key;
        return (
          <Link
            key={tab.key}
            href={href}
            className={`relative shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              active
                ? "bg-primary text-white shadow-xs"
                : "text-muted hover:bg-white hover:text-charcoal"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
