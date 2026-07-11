"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { AttentionBellButton } from "@/components/BottomNav";
import { AttentionFeed } from "@/components/AttentionFeed";
import { BottomSheet } from "@/components/BottomSheet";
import { EmailComingSoon } from "@/components/ComingSoonBanner";
import { useApp } from "@/providers/AppProvider";
import type { AttentionItem } from "@/lib/attention";
import { isCommitteeRoute, parseCommitteeId } from "@/lib/navigation";
import { CommitteeSelector } from "@/components/layout/CommitteeSelector";
import { CommitteeWorkspaceTabs } from "@/components/layout/CommitteeWorkspaceTabs";
import { UserMenu } from "@/components/layout/UserMenu";
import { BrandLogo } from "@/components/BrandLogo";

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
        <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 rounded-xl border border-charcoal/10 bg-white p-2 shadow-lg">
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
  const { user } = useApp();
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
      .then((d) => setAttentionItems(d.items ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (attentionOpen) loadAttention();
  }, [attentionOpen, loadAttention]);

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
          <div className="flex min-w-0 items-center gap-3 lg:gap-4">
            <div className="flex items-center gap-2 lg:hidden">
              <BrandLogo size={28} className="shrink-0" />
            </div>
            <CommitteeSelector />
          </div>

          <WorkspaceSearch
            value={searchQ}
            onChange={setSearchQ}
            results={searchResults}
            className="hidden min-w-0 flex-1 lg:block lg:max-w-sm lg:mx-auto"
          />

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <AttentionBellButton onClick={() => setAttentionOpen(true)} />
            <UserMenu />
          </div>
        </div>

        {onCommitteeRoute && committeeId && (
          <CommitteeWorkspaceTabs variant="header" />
        )}
      </header>

      <BottomSheet
        open={attentionOpen}
        onClose={() => setAttentionOpen(false)}
        title="Attention"
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-1">
          <EmailComingSoon />
          <AttentionFeed
            items={attentionItems}
            compact
            onAction={(item) => {
              setAttentionOpen(false);
              router.push(item.href);
            }}
          />
        </div>
      </BottomSheet>
    </>
  );
}
