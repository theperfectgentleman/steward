"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { HealthRing } from "@/components/HealthRing";
import { AlertFeed, type AlertItem } from "@/components/AlertFeed";
import { FeedbackReviewSheet } from "@/components/FeedbackReviewSheet";
import { InviteMemberSheet } from "@/components/InviteMemberSheet";
import { TouchButton } from "@/components/TouchButton";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import {
  canAcceptAssignments,
  canInviteMembers,
  canReviewFeedback,
  canViewAllCommittees,
} from "@/lib/types";
import { toPermissionUser } from "@/lib/permissions-client";
import { formatDate } from "@/lib/dates";
import { buildCommitteeDashboardStats } from "@/lib/dashboard-kpis";
import { DashboardStatsPanel } from "@/components/DashboardStatsPanel";
import { committeePath, suggestionsPath } from "@/lib/navigation";
import { PageShimmer } from "@/components/loading/PageShimmer";
import {
  Calendar,
  ClipboardList,
  FileText,
  FolderKanban,
  Inbox,
} from "lucide-react";

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
  const canReview = perm && canReviewFeedback(perm, committeeId ?? undefined);
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
                      ? "minutes"
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
      <p className="text-muted text-center py-12">
        Committee not found or you do not have access.
      </p>
    );
  }

  const shortcuts = [
    { href: committeePath(committeeId, "tasks"), label: "Task Board", icon: ClipboardList },
    { href: committeePath(committeeId, "projects"), label: "Projects", icon: FolderKanban },
    { href: committeePath(committeeId, "assignments"), label: "Inbox", icon: Inbox },
    { href: committeePath(committeeId, "schedule"), label: "Schedule", icon: Calendar },
    { href: committeePath(committeeId, "minutes"), label: "Minutes", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold text-accent uppercase tracking-wider">
          {committee.charterLetter}) Committee
        </p>
        <h1 className="text-2xl font-bold text-charcoal mt-1">{committee.name}</h1>
        {meta && (
          <p className="text-sm text-muted mt-1">
            {meta.reportingFrequency && `${meta.reportingFrequency} reporting`}
            {budgetsEnabled &&
              meta.budget != null &&
              ` · Budget $${meta.budget.toLocaleString()}`}
          </p>
        )}
        {meta?.description && (
          <p className="text-sm text-muted mt-2">{meta.description}</p>
        )}
        {canInvite && (
          <div className="mt-4">
            <TouchButton onClick={() => setInviteOpen(true)}>Invite member</TouchButton>
          </div>
        )}
      </div>

      <InviteMemberSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        committeeId={committeeId}
        committeeName={committee.name}
      />

      {canInbox && pendingInbox.length > 0 && (
        <section className="rounded-2xl border border-accent/30 bg-accent/5 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
              Pending assignments ({pendingAssignments})
            </h2>
            <Link
              href={committeePath(committeeId, "assignments")}
              className="text-sm font-semibold text-accent hover:underline"
            >
              Open inbox →
            </Link>
          </div>
          <ul className="space-y-2">
            {pendingInbox.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/assignments/${a.id}?action=accept`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white border border-charcoal/10 px-4 py-3 touch-target-lg hover:border-primary/40"
                >
                  <span className="font-semibold text-charcoal truncate">{a.title}</span>
                  <span className="text-xs text-muted shrink-0">From {a.createdBy.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {myOpenTaskList.length > 0 && (
        <section className="rounded-2xl border border-charcoal/10 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
              My open tasks ({myOpenTasks})
            </h2>
            <Link
              href={`${committeePath(committeeId, "tasks")}?filter=mine`}
              className="text-sm font-semibold text-accent hover:underline"
            >
              View board →
            </Link>
          </div>
          <ul className="space-y-2">
            {myOpenTaskList.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-1 py-1">
                <span className="text-sm font-semibold text-charcoal truncate">{t.title}</span>
                <span className="text-xs text-muted capitalize shrink-0">
                  {t.status.replace(/_/g, " ").toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <DashboardStatsPanel
        attention={kpiSections.attention}
        snapshot={kpiSections.snapshot}
        attentionTitle="Needs your attention"
        snapshotTitle="Committee snapshot"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {shortcuts.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="relative flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-white border border-charcoal/5 shadow-xs hover:border-primary/50 hover:shadow-sm touch-target-lg transition-all"
          >
            <Icon className="h-6 w-6 text-accent" />
            <span className="text-sm font-semibold text-charcoal">{label}</span>
            {label === "Inbox" && pendingAssignments > 0 && (
              <span className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
                {pendingAssignments > 9 ? "9+" : pendingAssignments}
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href={suggestionsPath(committeeId)}
          className="touch-target inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-primary text-white font-semibold hover:bg-primary-dark min-h-14 px-6 py-4 text-lg rounded-2xl w-full text-sm sm:text-base"
        >
          <MessageSquarePlus className="h-5 w-5 shrink-0" />
          Suggestions
        </Link>
        {canReview && (
          <FeedbackReviewSheet
            committeeId={committeeId}
            triggerClassName="w-full"
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-4">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
            Progress
          </h2>
          {stats && (
            <div className="bg-white rounded-2xl border border-charcoal/5 p-5 shadow-xs">
              <HealthRing
                label={committee.name}
                completed={stats.done}
                total={stats.total}
                blocked={stats.blocked}
              />
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
            Recent Tasks
          </h2>
          <div className="bg-white rounded-2xl border border-charcoal/5 overflow-hidden shadow-xs">
            <ul className="divide-y divide-charcoal/5">
              {tasks.map((t) => (
                <li key={t.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                  <p className="text-sm font-semibold text-charcoal">{t.title}</p>
                  <p className="text-xs text-muted font-medium capitalize mt-1">
                    {t.status.replace(/_/g, " ").toLowerCase()}
                  </p>
                </li>
              ))}
              {tasks.length === 0 && (
                <li className="px-5 py-8 text-center text-muted text-sm font-medium">No tasks yet.</li>
              )}
            </ul>
          </div>
          <Link
            href={committeePath(committeeId, "tasks")}
            className="inline-flex items-center text-sm font-semibold text-accent hover:underline mt-1"
          >
            View all tasks →
          </Link>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-bold text-accent uppercase tracking-wider">
            Committee Alerts
          </h2>
          <AlertFeed alerts={alerts} />
        </section>
      </div>
    </div>
  );
}
