"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import { useApp } from "@/providers/AppProvider";
import {
  ALL_GROUPS_ID,
  documentsPath,
  isAllGroups,
} from "@/lib/navigation";
import { toPermissionUser } from "@/lib/permissions-client";
import { canManageTor } from "@/lib/types";

type TorState = {
  committeeId: string;
  committeeName: string;
  torDocumentId: string | null;
  torTitle: string | null;
};

/**
 * Persistent strip when a single group is selected — TOR is the committee's
 * standing home, not just another Docs filter chip.
 */
export function CommitteeTorBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, activeCommitteeId } = useApp();
  const [tor, setTor] = useState<TorState | null>(null);

  const queryCommitteeId = searchParams.get("committeeId");
  const resolvedId =
    queryCommitteeId ??
    (activeCommitteeId && !isAllGroups(activeCommitteeId)
      ? activeCommitteeId
      : null);

  const hideOnStudio =
    pathname.startsWith("/documents/") && pathname !== "/documents";

  useEffect(() => {
    if (!user || !resolvedId || isAllGroups(resolvedId) || resolvedId === ALL_GROUPS_ID) {
      setTor(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/dashboard?committeeId=${encodeURIComponent(resolvedId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const s = Array.isArray(data.stats) ? data.stats[0] : null;
        if (!s) {
          setTor(null);
          return;
        }
        setTor({
          committeeId: s.id,
          committeeName: s.name,
          torDocumentId: s.torDocumentId ?? null,
          torTitle: s.torTitle ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setTor(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, resolvedId]);

  if (!tor || hideOnStudio) return null;

  const perm = user ? toPermissionUser(user) : null;
  const canAddTor = Boolean(
    perm && canManageTor(perm, tor.committeeId),
  );

  return (
    <div className="border-b border-charcoal/8 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2 lg:px-5">
        <BookOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
            {tor.committeeName} · Terms of Reference
          </p>
          <p className="truncate text-sm font-semibold text-charcoal">
            {tor.torTitle ??
              (canAddTor
                ? "No TOR yet — add one to guide this group’s work"
                : "No TOR yet — ask the chair to add one")}
          </p>
        </div>
        {tor.torDocumentId ? (
          <Link
            href={`/documents/${tor.torDocumentId}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary/90"
          >
            Open TOR
          </Link>
        ) : canAddTor ? (
          <Link
            href={documentsPath({
              committeeId: tor.committeeId,
              tag: "TOR",
            })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
          >
            <Plus className="h-3.5 w-3.5" />
            Add TOR
          </Link>
        ) : null}
      </div>
    </div>
  );
}
