"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Search,
} from "lucide-react";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  ASSIGNMENT_STATUS_LABELS,
  canCreatePresbyteryAssignment,
  type AssignmentStatus,
} from "@/lib/types";
import { assignmentPath, assignWorkPath } from "@/lib/navigation";
import { formatDate } from "@/lib/dates";
import {
  assignmentStatusChip,
  initials,
  isOpenAssignmentStatus,
  isReviewAssignmentStatus,
} from "@/lib/status-chips";

type AssignmentRow = {
  id: string;
  title: string;
  status: AssignmentStatus;
  source: string;
  priority: string;
  dueDate?: string | null;
  updatedAt: string;
  createdBy: { id: string; name: string };
  targetCommittee: {
    id: string;
    name: string;
    charterLetter: string | null;
  } | null;
  assignee?: { id: string; name: string } | null;
};

type ViewMode = "list" | "kanban";

const KANBAN_COLUMNS: AssignmentStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "CHAIR_APPROVED",
  "CLOSED",
];

export function PresbyteryAssignmentsView() {
  const { user } = useApp();
  const searchParams = useSearchParams();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("list");
  const [committeeFilter, setCommitteeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const perm = user ? toPermissionUser(user) : null;
  const canView = perm && canCreatePresbyteryAssignment(perm);
  const canCreate = Boolean(canView);

  const showOpenOnly = searchParams.get("status") === "open";
  const mineOnly = searchParams.get("mine") === "1";

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

  const committees = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<AssignmentRow["targetCommittee"]>
    >();
    for (const a of assignments) {
      if (a.targetCommittee) {
        map.set(a.targetCommittee.id, a.targetCommittee);
      }
    }
    return [...map.values()].sort((a, b) =>
      (a.charterLetter ?? a.name).localeCompare(b.charterLetter ?? b.name),
    );
  }, [assignments]);

  const filtered = useMemo(() => {
    let rows = assignments;
    if (showOpenOnly) {
      rows = rows.filter((a) => isOpenAssignmentStatus(a.status));
    }
    if (mineOnly && user) {
      rows = rows.filter((a) => a.createdBy.id === user.id);
    }
    if (committeeFilter !== "all") {
      rows = rows.filter((a) => a.targetCommittee?.id === committeeFilter);
    }
    if (statusFilter !== "all") {
      rows = rows.filter((a) => a.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.targetCommittee?.name.toLowerCase().includes(q) ?? false) ||
          (a.assignee?.name.toLowerCase().includes(q) ?? false) ||
          a.createdBy.name.toLowerCase().includes(q),
      );
    }
    return rows.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [
    assignments,
    showOpenOnly,
    mineOnly,
    user,
    committeeFilter,
    statusFilter,
    query,
  ]);

  const kpis = useMemo(() => {
    const active = filtered.filter((a) => isOpenAssignmentStatus(a.status)).length;
    const awaiting = filtered.filter((a) =>
      isReviewAssignmentStatus(a.status),
    ).length;
    const now = new Date();
    const completed = filtered.filter((a) => {
      if (a.status !== "CLOSED") return false;
      const d = new Date(a.updatedAt);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;
    return { active, awaiting, completed };
  }, [filtered]);

  const byCommittee = useMemo(() => {
    const groups = new Map<string, AssignmentRow[]>();
    for (const a of filtered) {
      const key = a.targetCommittee?.id ?? "__personal__";
      const list = groups.get(key) ?? [];
      list.push(a);
      groups.set(key, list);
    }
    return [...groups.entries()]
      .map(([id, rows]) => ({
        id,
        committee: rows[0].targetCommittee,
        rows,
      }))
      .sort((a, b) => {
        const aName =
          a.committee?.charterLetter ?? a.committee?.name ?? "Personal";
        const bName =
          b.committee?.charterLetter ?? b.committee?.name ?? "Personal";
        return aName.localeCompare(bName);
      });
  }, [filtered]);

  if (!user) return null;

  if (!canView) {
    return (
      <p className="py-6 text-center text-muted">
        Assignment pipeline is available to supervisory members and org admins.
      </p>
    );
  }

  const supervisoryLabel =
    user.organization?.settings.supervisoryLabel ?? "Supervisory";

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            {supervisoryLabel} assignment pipeline
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            View assignments by committee and progress — assign, track, and close
            work across the organisation.
          </p>
        </div>
        {canCreate && (
          <Link
            href={assignWorkPath()}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-charcoal px-4 text-sm font-semibold text-white transition hover:bg-charcoal/90"
          >
            <Plus className="h-4 w-4" />
            New assignment
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total active"
          value={kpis.active}
          icon={<FolderKanban className="h-5 w-5" />}
          tone="primary"
        />
        <KpiCard
          label="Awaiting review"
          value={kpis.awaiting}
          icon={<Search className="h-5 w-5" />}
          tone="accent"
        />
        <KpiCard
          label="Completed this month"
          value={kpis.completed}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="emerald"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-charcoal/8 bg-white p-3">
        <label className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assignments…"
            className="h-11 w-full rounded-xl border border-charcoal/10 bg-surface/50 pl-9 pr-3 text-sm outline-none focus:border-primary/40 focus:bg-white"
          />
        </label>
        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          className="h-11 min-w-[10rem] rounded-xl border border-charcoal/10 bg-white px-3 text-sm"
        >
          <option value="all">All committees</option>
          {committees.map((c) => (
            <option key={c.id} value={c.id}>
              {(c.charterLetter ? `${c.charterLetter.toUpperCase()}) ` : "") +
                c.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 min-w-[9rem] rounded-xl border border-charcoal/10 bg-white px-3 text-sm"
        >
          <option value="all">All statuses</option>
          {Object.entries(ASSIGNMENT_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex rounded-xl border border-charcoal/10 p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${
              view === "list"
                ? "bg-primary text-white"
                : "text-muted hover:text-charcoal"
            }`}
          >
            <List className="h-4 w-4" />
            List
          </button>
          <button
            type="button"
            onClick={() => setView("kanban")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${
              view === "kanban"
                ? "bg-primary text-white"
                : "text-muted hover:text-charcoal"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading assignments…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-charcoal/10 bg-white p-10 text-center text-muted">
          No assignments match these filters.
        </div>
      ) : view === "list" ? (
        <div className="space-y-4">
          {byCommittee.map(({ id, committee, rows }) => {
            const key = id;
            const open = !collapsed[key];
            const letter = committee?.charterLetter?.toUpperCase();
            const label = committee?.name ?? "Personal assignments";
            return (
              <section
                key={key}
                className="overflow-hidden rounded-2xl border border-charcoal/8 bg-white"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [key]: !c[key] }))
                  }
                  className="flex w-full min-h-12 items-center gap-3 border-b border-charcoal/6 px-4 py-3 text-left"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted" />
                  )}
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-xs font-bold text-primary-dark">
                    {letter ?? <ClipboardCheck className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold uppercase tracking-wide text-charcoal">
                      {letter ? `${letter}) ` : ""}
                      {label}
                    </p>
                    <p className="text-xs text-muted">
                      {rows.length} assignment{rows.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
                {open && (
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    {rows.map((a) => (
                      <AssignmentCard key={a.id} assignment={a} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {KANBAN_COLUMNS.map((status) => {
            const col = filtered.filter((a) => a.status === status);
            return (
              <div
                key={status}
                className="w-72 shrink-0 rounded-2xl border border-charcoal/8 bg-surface/80 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    {ASSIGNMENT_STATUS_LABELS[status]}
                  </p>
                  <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-charcoal">
                    {col.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {col.map((a) => (
                    <AssignmentCard key={a.id} assignment={a} compact />
                  ))}
                  {col.length === 0 && (
                    <p className="px-1 py-6 text-center text-xs text-muted">
                      Empty
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "primary" | "accent" | "emerald";
}) {
  const tones = {
    primary: "bg-primary/12 text-primary-dark border-primary/20",
    accent: "bg-accent/12 text-accent border-accent/20",
    emerald: "bg-primary text-white border-primary",
  };
  const iconTone = {
    primary: "bg-primary/20 text-primary-dark",
    accent: "bg-accent/20 text-accent",
    emerald: "bg-white/20 text-white",
  };
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 shadow-sm ${tones[tone]}`}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconTone[tone]}`}
      >
        {icon}
      </div>
      <div>
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            tone === "emerald" ? "text-white/80" : "opacity-80"
          }`}
        >
          {label}
        </p>
        <p className="text-xl font-bold tabular-nums leading-none mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}

function AssignmentCard({
  assignment: a,
  compact = false,
}: {
  assignment: AssignmentRow;
  compact?: boolean;
}) {
  return (
    <Link
      href={assignmentPath(a.id)}
      className={`group block rounded-xl border border-charcoal/8 bg-white px-3 py-2.5 transition hover:border-primary/40 hover:shadow-sm ${
        compact ? "p-3" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-charcoal leading-snug line-clamp-2">
          {a.title}
        </p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${assignmentStatusChip(a.status)}`}
        >
          {ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status}
        </span>
      </div>
      {!compact && (
        <p className="mt-2 text-xs text-muted">
          {a.targetCommittee?.name ?? a.assignee?.name ?? "Personal"}
          {a.dueDate ? ` · Due ${formatDate(a.dueDate)}` : ""}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-charcoal text-[10px] font-bold text-white">
            {initials(a.createdBy.name)}
          </span>
          <span className="truncate text-xs text-muted">{a.createdBy.name}</span>
        </div>
        <span className="text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
          View →
        </span>
      </div>
    </Link>
  );
}
