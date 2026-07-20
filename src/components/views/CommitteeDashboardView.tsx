"use client";

import { CommitteeWorkspaceTabs } from "@/components/layout/CommitteeWorkspaceTabs";
import { InviteMemberSheet } from "@/components/InviteMemberSheet";
import { TouchButton } from "@/components/TouchButton";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import {
  canAcceptAssignments,
  canInviteMembers,
  canViewAllCommittees,
} from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";
import { formatDate } from "@/lib/dates";
import { buildCommitteeDashboardStats } from "@/lib/dashboard-kpis";
import { DashboardStatGrid } from "@/components/DashboardStatsPanel";
import { committeePath } from "@/lib/navigation";
import { PageShimmer } from "@/components/loading/PageShimmer";
import { HealthRing } from "@/components/HealthRing";
import { AlertFeed, type AlertItem } from "@/components/AlertFeed";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type CommitteeStat = {
  total: number;
  done: number;
  blocked: number;
  activeProjects?: number;
};

type CommitteeMeta = {
  budget?: number | null;
  reportingFrequency?: string | null;
  description?: string | null;
};

type TaskPreview = {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
};

type InboxPreview = {
  id: string;
  title: string;
  createdBy: { name: string };
};

export function CommitteeDashboardView() {
  const { user, appSettings } = useApp();
  const budgetsEnabled = appSettings?.committeeBudgetsEnabled === true;
  const { committeeId, committee, loading } = useCommitteeContext();
  const [stats, setStats] = useState<CommitteeStat | null>(null);
  const [meta, setMeta] = useState<CommitteeMeta | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [tasks, setTasks] = useState<TaskPreview[]>([]);
  const [pendingInbox, setPendingInbox] = useState<InboxPreview[]>([]);
  const [myOpenTaskList, setMyOpenTaskList] = useState<TaskPreview[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState(0);
  const [myOpenTasks, setMyOpenTasks] = useState(0);
  const perm = user ? toPermissionUser(user) : null;
  const canInbox =
    perm && committeeId ? canAcceptAssignments(perm, committeeId) : false;
  const canInvite =
    perm && committeeId ? canInviteMembers(perm, committeeId) : false;
  const [inviteOpen, setInviteOpen] = useState(false);

  const kpiSections =
    committeeId && perm
      ? buildCommitteeDashboardStats({
          committeeId,
          stats,
          pendingAssignments,
          perm,
        })
      : { attention: [], snapshot: [] };

  const attentionTotal = kpiSections.attention.reduce((n, s) => {
    const v = typeof s.value === "number" ? s.value : 0;
    return n + v;
  }, 0);

  const load = useCallback(() => {
    if (!committeeId) return;

    fetch(`/api/dashboard?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.stats?.[0];
        if (s) {
          setStats({
            total: s.total,
            done: s.done,
            blocked: s.blocked,
            activeProjects: s.activeProjects,
          });
        }
        setPendingAssignments(data.pendingAssignments ?? 0);
        setMyOpenTasks(data.myOpenTasks ?? 0);
        setPendingInbox(data.pendingInbox ?? []);
        setMyOpenTaskList(data.myOpenTaskList ?? []);
        setAlerts(
          (data.alerts ?? []).map((a: AlertItem & { time: string }) => ({
            ...a,
            href:
              a.type === "assignment" && a.href
                ? a.href
                : committeePath(
                    committeeId,
                    a.type === "minutes"
                      ? "schedule"
                      : a.type === "blocked" || a.type === "completed"
                        ? "tasks"
                        : undefined,
                  ),
            time: formatDate(a.time),
          })),
        );
      })
      .catch(() => undefined);

    const scope =
      perm && canViewAllCommittees(perm) ? "all" : user?.id ?? "";
    fetch(`/api/committees?scope=${scope}&meta=true`)
      .then((r) => r.json())
      .then((list) => {
        const found = list.find((c: { id: string }) => c.id === committeeId);
        if (found) {
          setMeta({
            budget: found.budget,
            reportingFrequency: found.reportingFrequency,
            description: found.description,
          });
        }
      })
      .catch(() => undefined);

    fetch(`/api/tasks?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setTasks(data.slice(0, 5));
        }
      })
      .catch(() => setTasks([]));
  }, [committeeId, user?.id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return <PageShimmer variant="cards" />;
  }

  if (!committee || !committeeId) {
    return (
      <p className="text-muted text-center py-8">
        Committee not found or you do not have access.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-accent uppercase tracking-wider">
            {committee.charterLetter}) Committee
          </p>
          <h1 className="text-xl font-bold text-charcoal mt-0.5">{committee.name}</h1>
          {meta && (
            <p className="text-xs text-muted mt-0.5">
              {meta.reportingFrequency && `${meta.reportingFrequency} reporting`}
              {budgetsEnabled &&
                meta.budget != null &&
                ` · Budget $${meta.budget.toLocaleString()}`}
            </p>
          )}
          {meta?.description && (
            <p className="text-sm text-muted mt-1 line-clamp-2">{meta.description}</p>
          )}
        </div>
        {canInvite && (
          <TouchButton onClick={() => setInviteOpen(true)}>Invite member</TouchButton>
        )}
      </div>

      <CommitteeWorkspaceTabs />

      <InviteMemberSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        committeeId={committeeId}
        committeeName={committee.name}
      />

      {canInbox && pendingInbox.length > 0 && (
        <section className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[11px] font-bold text-accent uppercase tracking-wider">
              Pending assignments ({pendingAssignments})
            </h2>
            <Link
              href={committeePath(committeeId, "assignments")}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Open inbox →
            </Link>
          </div>
          <ul className="space-y-1">
            {pendingInbox.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/assignments/${a.id}?action=receive`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white border border-charcoal/10 px-3 py-2 hover:border-primary/40"
                >
                  <span className="text-sm font-semibold text-charcoal truncate">{a.title}</span>
                  <span className="text-[11px] text-muted shrink-0">From {a.createdBy.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {myOpenTaskList.length > 0 && (
        <section className="rounded-xl border border-charcoal/10 bg-white px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[11px] font-bold text-accent uppercase tracking-wider">
              My open tasks ({myOpenTasks})
            </h2>
            <Link
              href={`${committeePath(committeeId, "tasks")}?filter=mine`}
              className="text-xs font-semibold text-accent hover:underline"
            >
              View board →
            </Link>
          </div>
          <ul className="divide-y divide-charcoal/5">
            {myOpenTaskList.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-sm font-medium text-charcoal truncate">{t.title}</span>
                <span className="text-[11px] text-muted capitalize shrink-0">
                  {t.status.replace(/_/g, " ").toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DashboardStatGrid stats={kpiSections.snapshot} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <section className="space-y-2 min-w-0">
          <h2 className="text-[11px] font-bold text-accent uppercase tracking-wider">
            Committee Alerts
          </h2>
          <AlertFeed alerts={alerts} />
        </section>

        <section className="space-y-2 min-w-0">
          <h2 className="text-[11px] font-bold text-accent uppercase tracking-wider">
            Recent Tasks
          </h2>
          <div className="bg-white rounded-xl border border-charcoal/5 overflow-hidden shadow-xs">
            <ul className="divide-y divide-charcoal/5">
              {tasks.map((t) => (
                <li key={t.id} className="px-3 py-2 hover:bg-slate-50 transition-colors">
                  <p className="text-sm font-medium text-charcoal leading-snug">{t.title}</p>
                  <p className="text-[11px] text-muted font-medium capitalize">
                    {t.status.replace(/_/g, " ").toLowerCase()}
                  </p>
                </li>
              ))}
              {tasks.length === 0 && (
                <li className="px-3 py-5 text-center text-muted text-sm font-medium">
                  No tasks yet.
                </li>
              )}
            </ul>
          </div>
          <Link
            href={committeePath(committeeId, "tasks")}
            className="inline-flex items-center text-xs font-semibold text-accent hover:underline"
          >
            View all tasks →
          </Link>
        </section>

        <div className="space-y-3 md:col-span-2 lg:col-span-1">
          <section className="space-y-2">
            <h2 className="text-[11px] font-bold text-accent uppercase tracking-wider">
              Progress
            </h2>
            {stats && (
              <div className="bg-white rounded-xl border border-charcoal/5 px-3 py-3 shadow-xs">
                <HealthRing
                  label={committee.name}
                  completed={stats.done}
                  total={stats.total}
                  blocked={stats.blocked}
                />
              </div>
            )}
          </section>

          <section
            className={`rounded-xl border px-3 py-3 ${
              attentionTotal > 0
                ? "border-accent/30 bg-accent/5"
                : "border-primary/25 bg-primary/5"
            }`}
          >
            {attentionTotal > 0 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
                  Needs your attention
                </p>
                <DashboardStatGrid stats={kpiSections.attention} size="compact" />
              </div>
            ) : (
              <p className="text-sm text-muted leading-snug">
                Nothing needs your sign-off right now. Check the snapshot above for
                committee progress.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
