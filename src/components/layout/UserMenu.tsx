"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Building2, LogOut, ArrowLeftRight } from "lucide-react";
import { useApp } from "@/providers/AppProvider";
import { useNavModel } from "@/hooks/useNavModel";
import {
  COMMITTEE_TITLE_LABELS,
  SUPERVISORY_TITLE_LABELS,
  type CommitteeTitle,
  type SupervisoryTitle,
} from "@/lib/types";
import { committeePath } from "@/lib/navigation";

function committeeTitleLabel(
  title: CommitteeTitle,
  customTitle?: string | null,
) {
  if (title === "CUSTOM" && customTitle?.trim()) return customTitle.trim();
  return COMMITTEE_TITLE_LABELS[title] ?? title;
}

export function UserMenu() {
  const { user, logout, leaveOrganization } = useApp();
  const { committees } = useNavModel();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const membershipRows = useMemo(() => {
    if (!user) return [];

    const rows: { key: string; label: string; detail: string; href?: string }[] =
      [];

    const supervisory =
      user.supervisoryMembership ?? user.presbyteryMembership ?? null;
    if (supervisory) {
      const supervisoryLabel =
        user.organization?.settings.supervisoryLabel ?? "Presbytery";
      const title = (supervisory.title as SupervisoryTitle | undefined) ??
        (supervisory.isHead ? "HEAD" : "MEMBER");
      const detail =
        title === "CUSTOM" && supervisory.customTitle?.trim()
          ? supervisory.customTitle.trim()
          : SUPERVISORY_TITLE_LABELS[title] ?? "Member";
      rows.push({
        key: "supervisory",
        label: supervisoryLabel,
        detail,
        href: "/",
      });
    }

    const nameById = new Map(committees.map((c) => [c.id, c.name]));
    for (const m of user.committeeMemberships) {
      rows.push({
        key: m.committeeId,
        label: nameById.get(m.committeeId) ?? "Committee",
        detail: committeeTitleLabel(m.title, m.customTitle),
        href: committeePath(m.committeeId),
      });
    }

    return rows;
  }, [user, committees]);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const orgName = user.organization?.name;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 touch-target rounded-xl hover:bg-surface px-1 py-1 transition-colors"
        aria-label="Account menu"
        aria-expanded={open}
      >
        <div className="hidden sm:block text-right">
          <p className="text-sm font-semibold text-charcoal truncate max-w-[140px]">
            {user.name}
          </p>
          {orgName && (
            <p className="text-xs text-muted truncate max-w-[140px]">{orgName}</p>
          )}
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal text-white font-bold text-sm shrink-0">
          {initials}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-charcoal/10 shadow-lg py-2 z-50 max-h-[min(80vh,480px)] overflow-y-auto">
          <div className="px-4 py-3 border-b border-charcoal/10">
            <p className="font-semibold text-charcoal text-sm">{user.name}</p>
            {orgName && (
              <p className="text-xs text-muted mt-1 flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {orgName}
              </p>
            )}
          </div>

          {membershipRows.length > 0 && (
            <div className="border-b border-charcoal/10 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">
                Your memberships
              </p>
              <ul className="space-y-1">
                {membershipRows.map((row) => {
                  const content = (
                    <>
                      <span className="truncate font-medium text-charcoal">
                        {row.label}
                      </span>
                      <span className="shrink-0 text-muted">{row.detail}</span>
                    </>
                  );
                  return (
                    <li key={row.key}>
                      {row.href ? (
                        <Link
                          href={row.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface"
                        >
                          {content}
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs">
                          {content}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {user.activeOrganizationId && (
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await leaveOrganization();
                window.location.href = "/";
              }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-charcoal hover:bg-surface touch-target text-left"
            >
              <ArrowLeftRight className="h-5 w-5 text-muted" />
              Switch organization
            </button>
          )}
          {user.isPlatformAdmin && (
            <Link
              href="/super"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-charcoal hover:bg-surface touch-target"
              onClick={() => setOpen(false)}
            >
              Platform Super
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-charcoal hover:bg-surface touch-target text-left"
          >
            <LogOut className="h-5 w-5 text-muted" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
