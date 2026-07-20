"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { AttentionBellButton } from "@/components/BottomNav";
import { AttentionFeed } from "@/components/AttentionFeed";
import { BottomSheet } from "@/components/BottomSheet";
import { EmailComingSoon } from "@/components/ComingSoonBanner";
import { useApp } from "@/providers/AppProvider";
import { useNavModel } from "@/hooks/useNavModel";
import type { AttentionItem } from "@/lib/attention";
import { runAttentionPrimaryAction } from "@/lib/attention-actions";
import {
  dismissAttentionItem,
  filterDismissedAttention,
} from "@/lib/attention-dismiss";
import {
  committeePath,
  isCommitteeRoute,
  parseCommitteeId,
  parseCommitteeSection,
} from "@/lib/navigation";
import { CommitteeSelector } from "@/components/layout/CommitteeSelector";
import { UserMenu } from "@/components/layout/UserMenu";
import { BrandLogo } from "@/components/BrandLogo";

const CRUMB_MAX = 15;

const SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  tasks: "Board",
  projects: "Projects",
  schedule: "Schedule",
  assignments: "Assignments",
  documents: "Documents",
};

const TOP_ROUTE_CRUMBS: { match: (p: string) => boolean; labels: string[] }[] = [
  { match: (p) => p === "/assign-work", labels: ["Assign work"] },
  { match: (p) => p.startsWith("/assignments"), labels: ["Assignments"] },
  { match: (p) => p.startsWith("/reports"), labels: ["Reports"] },
  { match: (p) => p.startsWith("/documents"), labels: ["Documents"] },
  { match: (p) => p.startsWith("/messages"), labels: ["Messages"] },
  { match: (p) => p.startsWith("/my-work"), labels: ["My work"] },
  { match: (p) => p.startsWith("/suggestions"), labels: ["Suggestions"] },
  { match: (p) => p.startsWith("/admin/structure"), labels: ["Admin", "Structure"] },
  { match: (p) => p.startsWith("/admin/rbac"), labels: ["Admin", "RBAC"] },
  { match: (p) => p.startsWith("/admin"), labels: ["Admin"] },
  { match: (p) => p.startsWith("/tasks"), labels: ["Board"] },
  { match: (p) => p.startsWith("/schedule"), labels: ["Schedule"] },
];

function truncateCrumb(label: string) {
  const trimmed = label.trim();
  if (trimmed.length <= CRUMB_MAX) return trimmed;
  return `${trimmed.slice(0, CRUMB_MAX).trimEnd()}…`;
}

type Crumb = { label: string; href?: string };

function OrgBreadcrumbs({
  orgName,
  className = "",
}: {
  orgName: string;
  className?: string;
}) {
  const pathname = usePathname();
  const { committees } = useNavModel();
  const committeeId = parseCommitteeId(pathname);

  const crumbs = useMemo(() => {
    const items: Crumb[] = [{ label: orgName, href: "/" }];

    if (isCommitteeRoute(pathname) && committeeId) {
      const committee = committees.find((c) => c.id === committeeId);
      items.push({
        label: committee?.name ?? "Committee",
        href: committeePath(committeeId),
      });
      const section = parseCommitteeSection(pathname);
      if (section !== "overview") {
        items.push({
          label: SECTION_LABELS[section] ?? section,
          href: committeePath(committeeId, section),
        });
      }
      return items;
    }

    if (pathname === "/") return items;

    const route = TOP_ROUTE_CRUMBS.find((r) => r.match(pathname));
    if (route) {
      for (const label of route.labels) {
        items.push({ label });
      }
    }

    return items;
  }, [pathname, orgName, committees, committeeId]);

  return (
    <nav
      aria-label="Organization"
      className={`min-w-0 items-center gap-1 text-[13px] ${className}`}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        const isOrg = i === 0;
        const label = truncateCrumb(crumb.label);
        const tone = isOrg
          ? "text-charcoal"
          : isLast
            ? "text-stone-500"
            : "text-stone-400";
        return (
          <span key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 && (
              <ChevronRight
                className="h-3 w-3 shrink-0 text-stone-300"
                strokeWidth={1.75}
                aria-hidden
              />
            )}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                title={crumb.label}
                className={`truncate transition-colors hover:text-stone-600 ${tone}`}
              >
                {label}
              </Link>
            ) : (
              <span
                title={crumb.label}
                className={`truncate ${tone}`}
                aria-current={isLast ? "page" : undefined}
              >
                {label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function WorkspaceSearch({
  value,
  onChange,
  results,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  results: {
    assignments: { title: string; href: string }[];
    projects: { title: string; href: string }[];
    tasks: { title: string; href: string }[];
  } | null;
  className?: string;
}) {
  const items = results
    ? [
        ...results.assignments,
        ...results.projects,
        ...results.tasks,
      ]
    : [];

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search work…"
        className="h-9 w-full rounded-lg border border-charcoal/10 bg-surface/60 pl-9 pr-3 text-sm text-charcoal placeholder:text-muted/80 outline-none transition-colors focus:border-primary/40 focus:bg-white"
      />
      {results && (
        <div className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-[min(100vw-2rem,20rem)] rounded-xl border border-charcoal/10 bg-white p-2 shadow-lg">
          {items.length === 0 ? (
            <p className="p-2 text-xs text-muted">No results</p>
          ) : (
            <ul className="text-sm">
              {items.map((r, i) => (
                <li key={i}>
                  <Link
                    href={r.href}
                    className="block rounded-lg p-2 hover:bg-charcoal/5"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refreshAttention } = useApp();
  const committeeId = parseCommitteeId(pathname);
  const onCommitteeRoute = isCommitteeRoute(pathname);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{
    assignments: { title: string; href: string }[];
    projects: { title: string; href: string }[];
    tasks: { title: string; href: string }[];
  } | null>(null);

  const loadAttention = useCallback(() => {
    fetch("/api/attention")
      .then((r) => r.json())
      .then((d) =>
        setAttentionItems(filterDismissedAttention(d.items ?? [])),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (attentionOpen) loadAttention();
  }, [attentionOpen, loadAttention]);

  const openItem = (item: AttentionItem) => {
    dismissAttentionItem(item.id);
    setAttentionItems((prev) => prev.filter((i) => i.id !== item.id));
    setAttentionOpen(false);
    refreshAttention();
    router.push(item.href);
  };

  const runPrimary = async (item: AttentionItem) => {
    try {
      const result = await runAttentionPrimaryAction(item);
      if (result === "reloaded") {
        dismissAttentionItem(item.id);
        loadAttention();
        refreshAttention();
        return;
      }
      openItem(item);
    } catch {
      openItem(item);
    }
  };

  useEffect(() => {
    if (searchQ.length < 2) {
      setSearchResults(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(searchQ)}`)
        .then((r) => r.json())
        .then(setSearchResults)
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  if (!user) return null;

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-charcoal/8 bg-white/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4 lg:gap-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 lg:gap-4">
            <div className="flex items-center gap-2 lg:hidden">
              <BrandLogo size={28} className="shrink-0" />
            </div>
            {/* Committee switcher: mobile only — desktop uses sidebar tree */}
            <div className="lg:hidden">
              <CommitteeSelector />
            </div>
            {user.organization?.name && (
              <OrgBreadcrumbs
                orgName={user.organization.name}
                className="hidden lg:flex"
              />
            )}
          </div>

          <WorkspaceSearch
            value={searchQ}
            onChange={setSearchQ}
            results={searchResults}
            className="hidden w-52 shrink-0 lg:block xl:w-64"
          />

          <div className="flex shrink-0 items-center gap-0.5">
            <AttentionBellButton onClick={() => setAttentionOpen(true)} />
            <UserMenu />
          </div>
        </div>
      </header>

      <BottomSheet
        open={attentionOpen}
        onClose={() => setAttentionOpen(false)}
        title="Inbox"
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-1">
          <EmailComingSoon />
          <AttentionFeed
            items={attentionItems}
            compact
            onAction={runPrimary}
            onOpen={openItem}
          />
        </div>
      </BottomSheet>
    </>
  );
}
