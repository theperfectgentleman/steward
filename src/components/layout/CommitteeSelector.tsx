"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { useApp } from "@/providers/AppProvider";
import { canAcceptAssignments, canViewAllCommittees } from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  committeePath,
  isCommitteeRoute,
  parseCommitteeId,
} from "@/lib/navigation";
import type { CommitteeRef } from "@/lib/navigation";

function useCommitteeList() {
  const { user } = useApp();
  const [committees, setCommittees] = useState<CommitteeRef[]>([]);
  const [pendingByCommittee, setPendingByCommittee] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    if (!user) return;
    const perm = toPermissionUser(user);
    const scope = canViewAllCommittees(perm) ? "all" : user.id;
    fetch(`/api/committees?scope=${scope}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCommittees(data);
      })
      .catch(() => setCommittees([]));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const perm = toPermissionUser(user);
    fetch("/api/assignments?status=ASSIGNED")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) {
          setPendingByCommittee({});
          return;
        }
        const counts: Record<string, number> = {};
        for (const a of data as {
          targetCommitteeId?: string;
          targetCommittee?: { id: string };
        }[]) {
          const cid = a.targetCommitteeId ?? a.targetCommittee?.id;
          if (!cid) continue;
          if (!canAcceptAssignments(perm, cid)) continue;
          counts[cid] = (counts[cid] ?? 0) + 1;
        }
        setPendingByCommittee(counts);
      })
      .catch(() => setPendingByCommittee({}));
  }, [user]);

  return { user, committees, pendingByCommittee };
}

function CommitteeList({
  committees,
  pendingByCommittee,
  activeId,
  highlightOverall,
  query,
  onQueryChange,
  onPick,
  onPickOverall,
}: {
  committees: CommitteeRef[];
  pendingByCommittee: Record<string, number>;
  activeId: string | null;
  highlightOverall: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (c: CommitteeRef) => void;
  onPickOverall: () => void;
}) {
  const filtered = committees.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search committees…"
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-charcoal/10 bg-surface focus:border-primary outline-none"
        />
      </div>
      <ul className="space-y-1 max-h-[min(24rem,50vh)] overflow-y-auto">
        <li>
          <button
            type="button"
            onClick={onPickOverall}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
              highlightOverall
                ? "bg-primary/15 text-charcoal"
                : "text-muted hover:bg-surface hover:text-charcoal"
            }`}
          >
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface text-accent font-bold text-xs shrink-0">
              All
            </span>
            <span>Overall Dashboard</span>
          </button>
        </li>
        {filtered.map((c) => {
          const pending = pendingByCommittee[c.id] ?? 0;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick(c)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
                  activeId === c.id
                    ? "bg-primary/15 text-charcoal"
                    : pending > 0
                      ? "bg-accent/5 text-charcoal hover:bg-accent/10"
                      : "text-muted hover:bg-surface hover:text-charcoal"
                }`}
              >
                <span className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-accent/10 text-accent font-bold text-xs uppercase shrink-0">
                  {c.charterLetter}
                  {pending > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-accent text-white text-[9px] font-bold flex items-center justify-center">
                      {pending > 9 ? "9+" : pending}
                    </span>
                  )}
                </span>
                <span className="truncate flex-1">{c.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CommitteeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, committees, pendingByCommittee } = useCommitteeList();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const routeCommitteeId = parseCommitteeId(pathname);
  const onOverallDashboard = pathname === "/";
  const onCommitteeRoute = isCommitteeRoute(pathname);
  const activeId = onCommitteeRoute ? routeCommitteeId : null;
  const [storedCommitteeId, setStoredCommitteeId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setStoredCommitteeId(localStorage.getItem("unitycommit-committee"));
  }, []);

  const active =
    (activeId
      ? committees.find((c) => c.id === activeId)
      : null) ??
    (storedCommitteeId
      ? committees.find((c) => c.id === storedCommitteeId)
      : null) ??
    null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

  if (!user || committees.length === 0) return null;

  const perm = toPermissionUser(user);
  const showSwitcher =
    committees.length > 1 || canViewAllCommittees(perm);

  if (!showSwitcher) {
    return (
      <p className="max-w-[12rem] truncate text-sm font-semibold text-charcoal sm:max-w-xs">
        {active?.name ?? committees[0]?.name ?? "Committee"}
      </p>
    );
  }

  const pick = (c: CommitteeRef) => {
    localStorage.setItem("unitycommit-committee", c.id);
    setStoredCommitteeId(c.id);
    const section = pathname.match(
      /\/(tasks|schedule|minutes|projects|assignments|documents)(?:\/|$)/,
    )?.[1] as
      | "tasks"
      | "schedule"
      | "minutes"
      | "projects"
      | "assignments"
      | "documents"
      | undefined;
    router.push(committeePath(c.id, section));
    setOpen(false);
    setQuery("");
  };

  const pickOverall = () => {
    router.push("/");
    setOpen(false);
    setQuery("");
  };

  const label = onOverallDashboard
    ? "Overall Dashboard"
    : active?.name ?? "Select committee";
  const letter = onOverallDashboard ? "All" : active?.charterLetter ?? "?";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex max-w-[min(100vw-8rem,18rem)] items-center gap-2 rounded-lg border border-charcoal/10 bg-surface/70 py-1.5 pl-1.5 pr-2.5 text-left transition-colors hover:border-charcoal/20 hover:bg-surface sm:max-w-xs lg:max-w-sm"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[11px] font-bold uppercase text-accent">
          {letter}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-charcoal">
          {label}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.35rem)] z-50 hidden w-[min(100vw-2rem,22rem)] rounded-xl border border-charcoal/10 bg-white p-3 shadow-lg lg:block">
          <CommitteeList
            committees={committees}
            pendingByCommittee={pendingByCommittee}
            activeId={activeId}
            highlightOverall={onOverallDashboard}
            query={query}
            onQueryChange={setQuery}
            onPick={pick}
            onPickOverall={pickOverall}
          />
        </div>
      )}

      <div className="lg:hidden">
        <BottomSheet
          open={open}
          onClose={() => {
            setOpen(false);
            setQuery("");
          }}
          title="Switch committee"
        >
          <CommitteeList
            committees={committees}
            pendingByCommittee={pendingByCommittee}
            activeId={activeId}
            highlightOverall={onOverallDashboard}
            query={query}
            onQueryChange={setQuery}
            onPick={pick}
            onPickOverall={pickOverall}
          />
        </BottomSheet>
      </div>
    </div>
  );
}
