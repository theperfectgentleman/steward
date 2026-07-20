"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  FilePenLine,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";
import { TouchButton } from "@/components/TouchButton";
import { FORM_FIELD_CLASS } from "@/lib/form-field";
import {
  REPORT_STATUS_LABELS,
  canReviewReport,
  canSubmitReport,
  type ReportStatus,
} from "@/lib/types";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import { initials, reportStatusChip } from "@/lib/status-chips";

type ReportRow = {
  id: string;
  title: string;
  body: string | null;
  status: ReportStatus;
  reviewComment?: string | null;
  submittedAt?: string | null;
  finalizedAt?: string | null;
  updatedAt?: string;
  project: {
    id: string;
    title: string;
    committeeId: string;
    committee: { name: string; charterLetter?: string | null };
  };
  author: { name: string };
};

type ViewMode = "list" | "kanban";

const KANBAN_COLUMNS: ReportStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "FINAL",
];

export function ReportsPipelineView() {
  const { user, activeCommitteeId } = useApp();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [projects, setProjects] = useState<
    { id: string; title: string; committeeId: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<ViewMode>("list");
  const [committeeFilter, setCommitteeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({ projectId: "", title: "", body: "" });
  const [showComposer, setShowComposer] = useState(false);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiDraftError, setAiDraftError] = useState("");

  const perm = user ? toPermissionUser(user) : null;
  const canReview = perm ? canReviewReport(perm) : false;

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setReports(data);
        else setReports([]);
      })
      .catch(() => setReports([]))
      .finally(() => setLoading(false));

    if (activeCommitteeId) {
      fetch(`/api/projects?committeeId=${activeCommitteeId}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setProjects(data);
        })
        .catch(() => undefined);
    }
  }, [activeCommitteeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const committees = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const r of reports) {
      map.set(r.project.committeeId, {
        id: r.project.committeeId,
        name: r.project.committee.name,
      });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  const filtered = useMemo(() => {
    let rows = reports;
    if (committeeFilter !== "all") {
      rows = rows.filter((r) => r.project.committeeId === committeeFilter);
    }
    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.project.title.toLowerCase().includes(q) ||
          r.project.committee.name.toLowerCase().includes(q) ||
          r.author.name.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [reports, committeeFilter, statusFilter, query]);

  const kpis = useMemo(() => {
    const awaiting = filtered.filter((r) => r.status === "SUBMITTED").length;
    const returned = filtered.filter((r) => r.status === "RETURNED").length;
    const now = new Date();
    const finalized = filtered.filter((r) => {
      if (r.status !== "FINAL") return false;
      const d = new Date(r.finalizedAt ?? r.updatedAt ?? "");
      if (Number.isNaN(d.getTime())) return true;
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;
    return { awaiting, returned, finalized };
  }, [filtered]);

  const byCommittee = useMemo(() => {
    const groups = new Map<string, ReportRow[]>();
    for (const r of filtered) {
      const key = r.project.committeeId;
      const list = groups.get(key) ?? [];
      list.push(r);
      groups.set(key, list);
    }
    return [...groups.entries()]
      .map(([id, rows]) => ({
        id,
        name: rows[0].project.committee.name,
        rows,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const createDraft = async () => {
    if (!form.projectId || !form.title.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setForm({ projectId: "", title: "", body: "" });
      setShowComposer(false);
      refresh();
    } finally {
      setSaving(false);
    }
  };

  const draftWithAi = async () => {
    if (!form.projectId) {
      setAiDraftError("Select a project first");
      return;
    }
    setAiDraftLoading(true);
    setAiDraftError("");
    try {
      const res = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "report_draft",
          projectId: form.projectId,
          title: form.title || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiDraftError(data.error ?? "AI draft failed");
        return;
      }
      setForm((f) => ({
        ...f,
        body: data.suggestion ?? f.body,
        title: f.title.trim() || "Progress report",
      }));
    } catch {
      setAiDraftError("Network error");
    } finally {
      setAiDraftLoading(false);
    }
  };

  const act = async (
    id: string,
    action: "submit" | "return" | "approve",
    reviewComment?: string,
  ) => {
    setSaving(true);
    try {
      await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reviewComment }),
      });
      refresh();
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const canCompose =
    perm &&
    activeCommitteeId &&
    canSubmitReport(perm, activeCommitteeId) &&
    projects.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-charcoal">
            Report pipeline
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Draft → submit → review → final. Approving a final report completes
            the linked project.
          </p>
        </div>
        {canCompose && (
          <button
            type="button"
            onClick={() => setShowComposer((v) => !v)}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-charcoal px-4 text-sm font-semibold text-white"
          >
            <FilePenLine className="h-4 w-4" />
            {showComposer ? "Hide composer" : "New draft"}
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Awaiting review"
          value={kpis.awaiting}
          tone="accent"
          icon={<Search className="h-5 w-5" />}
        />
        <Kpi
          label="Returned"
          value={kpis.returned}
          tone="amber"
          icon={<FileCheck2 className="h-5 w-5" />}
        />
        <Kpi
          label="Finalized this month"
          value={kpis.finalized}
          tone="primary"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </div>

      {showComposer && canCompose && (
        <section className="space-y-3 rounded-xl border border-charcoal/8 bg-white p-3">
          <h2 className="font-semibold text-charcoal">New draft report</h2>
          <select
            className={FORM_FIELD_CLASS}
            value={form.projectId}
            onChange={(e) =>
              setForm((f) => ({ ...f, projectId: e.target.value }))
            }
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <input
            className={FORM_FIELD_CLASS}
            placeholder="Report title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className={FORM_FIELD_CLASS}
            rows={4}
            placeholder="Report body"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          {aiDraftError && (
            <p className="text-sm text-accent">{aiDraftError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <TouchButton
              variant="secondary"
              onClick={draftWithAi}
              disabled={aiDraftLoading || !form.projectId}
            >
              {aiDraftLoading ? "Drafting…" : "Draft with AI"}
            </TouchButton>
            <TouchButton onClick={createDraft} disabled={saving}>
              Save draft
            </TouchButton>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-charcoal/8 bg-white p-3">
        <label className="relative min-w-[10rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports…"
            className="h-11 w-full rounded-xl border border-charcoal/10 bg-surface/50 pl-9 pr-3 text-sm outline-none focus:border-primary/40"
          />
        </label>
        <select
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
          className="h-11 min-w-[10rem] rounded-xl border border-charcoal/10 px-3 text-sm"
        >
          <option value="all">All committees</option>
          {committees.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 min-w-[9rem] rounded-xl border border-charcoal/10 px-3 text-sm"
        >
          <option value="all">All statuses</option>
          {Object.entries(REPORT_STATUS_LABELS).map(([k, label]) => (
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
        <p className="text-muted">Loading reports…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-charcoal/10 bg-white p-10 text-center text-muted">
          No reports match these filters.
        </div>
      ) : view === "list" ? (
        <div className="space-y-4">
          {byCommittee.map((group) => {
            const open = !collapsed[group.id];
            return (
              <section
                key={group.id}
                className="overflow-hidden rounded-2xl border border-charcoal/8 bg-white"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [group.id]: !c[group.id] }))
                  }
                  className="flex w-full min-h-12 items-center gap-3 border-b border-charcoal/6 px-4 py-3 text-left"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted" />
                  )}
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary-dark">
                    <FilePenLine className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold uppercase tracking-wide text-charcoal">
                      {group.name}
                    </p>
                    <p className="text-xs text-muted">
                      {group.rows.length} report
                      {group.rows.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
                {open && (
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    {group.rows.map((r) => (
                      <ReportCard
                        key={r.id}
                        report={r}
                        perm={perm}
                        canReview={canReview}
                        saving={saving}
                        onAct={act}
                      />
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
            const col = filtered.filter((r) => r.status === status);
            return (
              <div
                key={status}
                className="w-72 shrink-0 rounded-2xl border border-charcoal/8 bg-surface/80 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    {REPORT_STATUS_LABELS[status]}
                  </p>
                  <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold">
                    {col.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {col.map((r) => (
                    <ReportCard
                      key={r.id}
                      report={r}
                      perm={perm}
                      canReview={canReview}
                      saving={saving}
                      onAct={act}
                      compact
                    />
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

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "primary" | "accent" | "amber";
}) {
  const tones = {
    primary: "bg-primary text-white border-primary",
    accent: "bg-accent/12 text-accent border-accent/20",
    amber: "bg-amber-50 text-amber-900 border-amber-200",
  };
  const iconBox = {
    primary: "bg-white/20 text-white",
    accent: "bg-accent/20 text-accent",
    amber: "bg-amber-100 text-amber-800",
  };
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border p-3 shadow-sm ${tones[tone]}`}
    >
      <div
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBox[tone]}`}
      >
        {icon}
      </div>
      <div>
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            tone === "primary" ? "text-white/80" : "opacity-80"
          }`}
        >
          {label}
        </p>
        <p className="mt-0.5 text-xl font-bold tabular-nums leading-none">
          {value}
        </p>
      </div>
    </div>
  );
}

function ReportCard({
  report: r,
  perm,
  canReview,
  saving,
  onAct,
  compact = false,
}: {
  report: ReportRow;
  perm: ReturnType<typeof toPermissionUser> | null;
  canReview: boolean;
  saving: boolean;
  onAct: (
    id: string,
    action: "submit" | "return" | "approve",
    reviewComment?: string,
  ) => void;
  compact?: boolean;
}) {
  const canSubmit =
    perm &&
    (r.status === "DRAFT" || r.status === "RETURNED") &&
    canSubmitReport(perm, r.project.committeeId);

  return (
    <div
      className={`rounded-xl border border-charcoal/8 bg-white p-4 ${
        compact ? "p-3" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-charcoal leading-snug line-clamp-2">
          {r.title}
        </p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${reportStatusChip(r.status)}`}
        >
          {REPORT_STATUS_LABELS[r.status]}
        </span>
      </div>
      {!compact && (
        <>
          <p className="mt-2 text-xs text-muted">
            {r.project.committee.name} · {r.project.title}
          </p>
          {r.body && (
            <p className="mt-2 line-clamp-3 text-sm text-stone-600 whitespace-pre-wrap">
              {r.body}
            </p>
          )}
          {r.reviewComment && (
            <p className="mt-2 text-xs text-amber-800">
              Review: {r.reviewComment}
            </p>
          )}
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-charcoal text-[10px] font-bold text-white">
            {initials(r.author.name)}
          </span>
          <span className="text-xs text-muted">{r.author.name}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <TouchButton
              onClick={() => onAct(r.id, "submit")}
              disabled={saving}
            >
              Submit
            </TouchButton>
          )}
          {canReview && r.status === "SUBMITTED" && (
            <>
              <TouchButton
                onClick={() => onAct(r.id, "approve")}
                disabled={saving}
              >
                Approve
              </TouchButton>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  onAct(r.id, "return", "Please revise and resubmit")
                }
                className="min-h-11 rounded-xl border border-charcoal/15 px-3 text-sm font-semibold text-charcoal"
              >
                Return
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
