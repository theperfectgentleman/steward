"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Search } from "lucide-react";
import { BottomSheet } from "@/components/BottomSheet";
import { useApp } from "@/providers/AppProvider";
import { canManageTor, canViewAllCommittees } from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  ALL_GROUPS_ID,
  documentsPath,
  isAllGroups,
  peerPathForGroup,
  tasksPath,
} from "@/lib/navigation";
import type { CommitteeRef } from "@/lib/navigation";

function useCommitteeList() {
  const { user } = useApp();
  const [committees, setCommittees] = useState<CommitteeRef[]>([]);

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

  return { user, committees };
}

function CommitteeList({
  committees,
  activeId,
  highlightAll,
  query,
  onQueryChange,
  onPick,
  onPickAll,
  committeeLabel,
  allLabel,
}: {
  committees: CommitteeRef[];
  activeId: string | null;
  highlightAll: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (c: CommitteeRef) => void;
  onPickAll: () => void;
  committeeLabel: string;
  allLabel: string;
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
          placeholder={`Search ${committeeLabel.toLowerCase()}s…`}
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-charcoal/10 bg-surface focus:border-primary outline-none"
        />
      </div>
      <ul className="space-y-1 max-h-[min(24rem,50vh)] overflow-y-auto">
        <li>
          <button
            type="button"
            onClick={onPickAll}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
              highlightAll
                ? "bg-primary/15 text-charcoal"
                : "text-muted hover:bg-surface hover:text-charcoal"
            }`}
          >
            <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-surface text-accent font-bold text-xs shrink-0">
              All
            </span>
            <span>{allLabel}</span>
          </button>
        </li>
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${
                activeId === c.id
                  ? "bg-primary/15 text-charcoal"
                  : "text-muted hover:bg-surface hover:text-charcoal"
              }`}
            >
              <span className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-accent/10 text-accent font-bold text-xs uppercase shrink-0">
                {c.charterLetter}
              </span>
              <span className="truncate flex-1">{c.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommitteeSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { setActiveCommitteeId, clearActiveCommitteeId } = useApp();
  const { user, committees } = useCommitteeList();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const queryCommitteeId = searchParams.get("committeeId");
  const [storedCommitteeId, setStoredCommitteeId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setStoredCommitteeId(localStorage.getItem("unitycommit-committee"));
  }, []);

  const resolvedId =
    queryCommitteeId ??
    storedCommitteeId ??
    null;

  const onAll = isAllGroups(resolvedId) || resolvedId === ALL_GROUPS_ID;
  const activeId = onAll ? null : resolvedId;
  const active = activeId
    ? committees.find((c) => c.id === activeId) ?? null
    : null;

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
  const committeeLabel =
    user.organization?.settings.committeeLabel ?? "Committee";

  if (!showSwitcher) {
    return (
      <p className="max-w-[12rem] truncate text-sm font-semibold text-charcoal sm:max-w-xs">
        {active?.name ?? committees[0]?.name ?? committeeLabel}
      </p>
    );
  }

  const pick = async (c: CommitteeRef) => {
    setActiveCommitteeId(c.id);
    setStoredCommitteeId(c.id);
    setOpen(false);
    setQuery("");

    // From Home, land on the group's TOR — committees live on TOR
    if (pathname === "/") {
      try {
        const res = await fetch(
          `/api/dashboard?committeeId=${encodeURIComponent(c.id)}`,
        );
        const data = await res.json();
        const s = Array.isArray(data.stats) ? data.stats[0] : null;
        if (s?.torDocumentId) {
          router.push(`/documents/${s.torDocumentId}`);
          return;
        }
      } catch {
        /* fall through */
      }
      const perm = toPermissionUser(user);
      if (canManageTor(perm, c.id)) {
        router.push(documentsPath({ committeeId: c.id, tag: "TOR" }));
      } else {
        router.push(tasksPath(c.id));
      }
      return;
    }

    router.push(peerPathForGroup(pathname, c.id));
  };

  const pickAll = () => {
    clearActiveCommitteeId();
    setStoredCommitteeId(ALL_GROUPS_ID);
    localStorage.setItem("unitycommit-committee", ALL_GROUPS_ID);
    router.push(peerPathForGroup(pathname, ALL_GROUPS_ID));
    setOpen(false);
    setQuery("");
  };

  const allLabel = canViewAllCommittees(perm) ? "All groups" : "All my groups";
  const label = onAll ? allLabel : active?.name ?? `Select ${committeeLabel.toLowerCase()}`;
  const letter = onAll ? "All" : active?.charterLetter ?? "?";

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
            activeId={activeId}
            highlightAll={onAll}
            query={query}
            onQueryChange={setQuery}
            onPick={pick}
            onPickAll={pickAll}
            committeeLabel={committeeLabel}
            allLabel={allLabel}
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
          title="Switch group"
        >
          <CommitteeList
            committees={committees}
            activeId={activeId}
            highlightAll={onAll}
            query={query}
            onQueryChange={setQuery}
            onPick={pick}
            onPickAll={pickAll}
            committeeLabel={committeeLabel}
            allLabel={allLabel}
          />
        </BottomSheet>
      </div>
    </div>
  );
}
