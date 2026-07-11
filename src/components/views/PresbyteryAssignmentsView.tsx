"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import { canCreatePresbyteryAssignment } from "@/lib/types";
import { assignmentPath } from "@/lib/navigation";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/types";

type AssignmentRow = {
  id: string;
  title: string;
  status: string;
  source: string;
  priority: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
  targetCommittee: { id: string; name: string; charterLetter: string };
};

const OPEN_STATUSES = new Set([
  "DRAFT",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "RETURNED",
  "CHAIR_APPROVED",
]);

export function PresbyteryAssignmentsView() {
  const { user } = useApp();
  const searchParams = useSearchParams();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const perm = user ? toPermissionUser(user) : null;
  const canView = perm && canCreatePresbyteryAssignment(perm);

  const load = useCallback(() => {
    fetch("/api/assignments")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAssignments(data);
        else setAssignments([]);
      })
      .catch(() => setAssignments([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showOpenOnly = searchParams.get("status") === "open";
  const mineOnly = searchParams.get("mine") === "1";

  const visible = useMemo(() => {
    let rows = assignments;
    if (showOpenOnly) {
      rows = rows.filter((a) => OPEN_STATUSES.has(a.status));
    }
    if (mineOnly && user) {
      rows = rows.filter((a) => a.createdBy.id === user.id);
    }
    return rows.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [assignments, showOpenOnly, mineOnly, user]);

  if (!user) return null;

  if (!canView) {
    return (
      <p className="text-center text-muted py-12">
        Presbytery assignment pipeline is available to presbytery members.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">Assignment pipeline</h1>
        <p className="text-sm text-muted mt-1">
          {mineOnly
            ? "Directives you created that still need a next step"
            : showOpenOnly
              ? "Open presbytery directives across all committees — for visibility"
              : "All presbytery assignments and their current status"}
        </p>
      </div>

      {loading ? (
        <p className="text-muted">Loading assignments…</p>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-charcoal/10 bg-white p-8 text-center text-muted">
          {showOpenOnly ? "No open assignments right now." : "No assignments yet."}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((a) => (
            <li key={a.id}>
              <Link
                href={assignmentPath(a.id)}
                className="flex items-center justify-between gap-4 rounded-2xl border border-charcoal/10 bg-white px-4 py-4 hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-charcoal truncate">{a.title}</p>
                  <p className="text-sm text-muted mt-0.5">
                    {a.targetCommittee.charterLetter.toUpperCase()}){" "}
                    {a.targetCommittee.name} · {a.createdBy.name}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-charcoal">
                  {ASSIGNMENT_STATUS_LABELS[
                    a.status as keyof typeof ASSIGNMENT_STATUS_LABELS
                  ] ?? a.status.replace(/_/g, " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
