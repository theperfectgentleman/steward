"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  committeePath,
  parseCommitteeId,
  parseCommitteeSection,
} from "@/lib/navigation";

const TABS = [
  { key: "overview", label: "Overview", section: undefined },
  { key: "tasks", label: "Board", section: "tasks" as const },
  { key: "projects", label: "Projects", section: "projects" as const },
  { key: "schedule", label: "Schedule", section: "schedule" as const },
  { key: "minutes", label: "Minutes", section: "minutes" as const },
];

export function CommitteeWorkspaceTabs({
  variant = "page",
}: {
  variant?: "page" | "header";
}) {
  const pathname = usePathname();
  const committeeId = parseCommitteeId(pathname);
  if (!committeeId) return null;

  const current = parseCommitteeSection(pathname);

  if (variant === "header") {
    return (
      <nav
        className="flex gap-1 overflow-x-auto px-4 lg:px-6 border-t border-charcoal/6"
        aria-label="Committee sections"
      >
        {TABS.map((tab) => {
          const href = tab.section
            ? committeePath(committeeId, tab.section)
            : committeePath(committeeId);
          const active =
            current === tab.key ||
            (tab.key === "overview" && current === "overview");
          return (
            <Link
              key={tab.key}
              href={href}
              className={`shrink-0 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-primary text-charcoal"
                  : "border-transparent text-muted hover:text-charcoal hover:border-charcoal/15"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
      aria-label="Committee sections"
    >
      {TABS.map((tab) => {
        const href = tab.section
          ? committeePath(committeeId, tab.section)
          : committeePath(committeeId);
        const active =
          current === tab.key ||
          (tab.key === "overview" && current === "overview");
        return (
          <Link
            key={tab.key}
            href={href}
            className={`shrink-0 touch-target px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
              active
                ? "bg-primary border-primary text-white"
                : "bg-white border-charcoal/10 text-muted hover:border-charcoal/20"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
