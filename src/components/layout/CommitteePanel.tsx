"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useApp } from "@/providers/AppProvider";
import { canViewAllCommittees } from "@/lib/types";
import { committeePath, isCommitteeRoute, parseCommitteeId } from "@/lib/navigation";
import type { CommitteeRef } from "@/lib/navigation";

export function CommitteePanel() {
  const pathname = usePathname();
  const { user } = useApp();
  const [committees, setCommittees] = useState<CommitteeRef[]>([]);
  const [query, setQuery] = useState("");
  const activeId = parseCommitteeId(pathname);

  useEffect(() => {
    if (!user) return;
    const scope = canViewAllCommittees(user.role) ? "all" : user.id;
    fetch(`/api/committees?scope=${scope}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCommittees(data);
      })
      .catch(() => setCommittees([]));
  }, [user]);

  if (!user) return null;

  const filtered = committees.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

  const showPanel =
    committees.length > 1 || canViewAllCommittees(user.role);

  if (!showPanel) return null;

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-charcoal/10 bg-white">
      <div className="p-4 border-b border-charcoal/10">
        <h2 className="text-sm font-bold text-charcoal">Committees</h2>
        <p className="text-xs text-muted mt-0.5">
          {canViewAllCommittees(user.role) ? "All 19 committees" : "Your committees"}
        </p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-charcoal/10 bg-surface focus:border-primary outline-none"
          />
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-1">
        <li>
          <Link
            href="/"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              pathname === "/" && !isCommitteeRoute(pathname)
                ? "bg-primary/15 text-charcoal"
                : "text-muted hover:bg-surface hover:text-charcoal"
            }`}
          >
            <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface text-accent font-bold text-xs">
              All
            </span>
            Overall Dashboard
          </Link>
        </li>
        {filtered.map((c) => (
          <li key={c.id}>
            <Link
              href={committeePath(c.id)}
              onClick={() => localStorage.setItem("unitycommit-committee", c.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeId === c.id
                  ? "bg-primary/15 text-charcoal"
                  : "text-muted hover:bg-surface hover:text-charcoal"
              }`}
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent/10 text-accent font-bold text-xs uppercase">
                {c.charterLetter}
              </span>
              <span className="truncate">{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
