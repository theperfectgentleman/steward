"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Calendar, FileText } from "lucide-react";
import { AlertFeed, type AlertItem } from "@/components/AlertFeed";
import { DashboardStatsPanel } from "@/components/DashboardStatsPanel";
import { GanttChart, type GanttItem } from "@/components/GanttChart";
import { QuickActionLink } from "@/components/QuickActionLink";
import { TaskStatusBreakdown } from "@/components/TaskStatusBreakdown";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  canCreateDirective,
  canViewAllCommittees,
  canManageTor,
} from "@/lib/types";
import { buildOverallDashboardStats } from "@/lib/dashboard-kpis";
import {
  tasksAssignPath,
  documentsPath,
  eventsPath,
  tasksPath,
  isAllGroups,
} from "@/lib/navigation";

type CommitteeStat = {
  id: string;
  charterLetter: string;
  name: string;
  total: number;
  todo?: number;
  inProgress?: number;
  done: number;
  blocked: number;
  inReview?: number;
  upcomingEvents?: number;
  torDocumentId?: string | null;
  torTitle?: string | null;
};

export function OverallDashboardView() {
  const router = useRouter();
  const { user, activeCommitteeId } = useApp();
  const [stats, setStats] = useState<CommitteeStat[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState(0);
  const [tasksInReview, setTasksInReview] = useState(0);
  const [myOpenTasks, setMyOpenTasks] = useState(0);
  const [timelineGoals, setTimelineGoals] = useState<GanttItem[]>([]);
  const [viewMode, setViewMode] = useState<"gantt" | "cards">("gantt");

  const perm = user ? toPermissionUser(user) : null;
  const isExecutive = !!(perm && canViewAllCommittees(perm));
  const canAssign = !!(perm && canCreateDirective(perm));
  const supervisoryLabel =
    user?.organization?.settings.supervisoryLabel ?? "Governance";
  const committeeLabel =
    user?.organization?.settings.committeeLabel ?? "Committee";

  const loadDashboard = useCallback(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats ?? []);
        setUpcomingEvents(data.upcomingEvents ?? 0);
        setTasksInReview(data.tasksInReview ?? 0);
        setMyOpenTasks(data.myOpenTasks ?? 0);
        setTimelineGoals(data.timelineGoals ?? []);
        setAlerts(
          (data.alerts ?? []).map(
            (a: AlertItem & { time: string; href?: string }) => ({
              ...a,
              href:
                a.href ??
                (a.type === "minutes"
                  ? eventsPath(a.committeeId)
                  : tasksPath(a.committeeId)),
            }),
          ),
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 60_000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const totals = stats.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      done: acc.done + s.done,
      blocked: acc.blocked + s.blocked,
    }),
    { total: 0, done: 0, blocked: 0 },
  );

  const pendingMinutes = alerts.filter((a) => a.type === "minutes").length;

  const kpiSections = buildOverallDashboardStats({
    stats,
    alerts,
    totals,
    pendingMinutes,
    openDirectives: tasksInReview,
    awaitingCloseCount: 0,
    directiveDrafts: 0,
    upcomingEvents,
    myOpenTasks,
    perm,
  });

  const handleAlertClick = (alert: AlertItem) => {
    if (alert.href) {
      if (alert.committeeId) {
        localStorage.setItem("unitycommit-committee", alert.committeeId);
      }
      router.push(alert.href);
    }
  };

  const assignCommitteeId =
    activeCommitteeId && !isAllGroups(activeCommitteeId)
      ? activeCommitteeId
      : (stats[0]?.id ?? null);

  const quickActions = [
    canAssign
      ? {
          key: "assign",
          href: tasksAssignPath(assignCommitteeId),
          label: "Assign directive",
          icon: ClipboardCheck,
        }
      : null,
    {
      key: "events",
      href: eventsPath(),
      label: "Events",
      icon: Calendar,
    },
    {
      key: "documents",
      href: documentsPath(),
      label: "Docs",
      icon: FileText,
    },
  ].filter(
    (action): action is {
      key: string;
      href: string;
      label: string;
      icon: typeof FileText;
    } => action != null,
  );

  const committeeCards =
    stats.length === 0 ? (
      <p className="text-center text-muted py-6 rounded-xl border border-charcoal/5 bg-white text-sm">
        No group data yet.
      </p>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {stats.map((s) => {
          const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
          return (
            <div
              key={s.id}
              className="flex flex-col gap-1.5 rounded-xl border border-charcoal/5 bg-white px-3 py-2.5 shadow-xs hover:border-primary/30 transition-colors"
            >
              <Link
                href={tasksPath(s.id)}
                onClick={() =>
                  localStorage.setItem("unitycommit-committee", s.id)
                }
                className="flex items-start gap-2.5 min-w-0"
              >
                <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent/10 border border-accent/20 text-accent font-extrabold uppercase shrink-0 text-xs">
                  {s.charterLetter}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-charcoal text-sm leading-snug line-clamp-2">
                      {s.name}
                    </p>
                    <span className="text-xs font-bold text-charcoal shrink-0 tabular-nums">
                      {pct}%
                    </span>
                  </div>
                </div>
              </Link>
              <TaskStatusBreakdown
                compact
                counts={{
                  TODO: s.todo ?? 0,
                  IN_PROGRESS: s.inProgress ?? 0,
                  IN_REVIEW: s.inReview ?? 0,
                  DONE: s.done,
                  BLOCKED: s.blocked,
                  total: s.total,
                }}
              />
              <p className="text-[11px] text-muted font-medium">
                {s.done}/{s.total} tasks · {s.blocked} awaiting
                {s.upcomingEvents != null && s.upcomingEvents > 0
                  ? ` · ${s.upcomingEvents} upcoming`
                  : ""}
              </p>
              {s.torDocumentId ? (
                <Link
                  href={`/documents/${s.torDocumentId}`}
                  onClick={() =>
                    localStorage.setItem("unitycommit-committee", s.id)
                  }
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  View TOR
                </Link>
              ) : perm && canManageTor(perm, s.id) ? (
                <Link
                  href={documentsPath({ committeeId: s.id, tag: "TOR" })}
                  onClick={() =>
                    localStorage.setItem("unitycommit-committee", s.id)
                  }
                  className="text-[11px] font-semibold text-muted hover:text-primary hover:underline"
                >
                  Add TOR
                </Link>
              ) : (
                <span className="text-[11px] text-muted">No TOR yet</span>
              )}
            </div>
          );
        })}
      </div>
    );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-charcoal">
          {isExecutive ? `${supervisoryLabel} overview` : "Home"}
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {isExecutive
            ? `Org-wide glance across ${committeeLabel.toLowerCase()}s — act in Work`
            : `Your ${committeeLabel.toLowerCase()}s at a glance`}
        </p>
      </div>

      <DashboardStatsPanel
        attention={kpiSections.attention}
        snapshot={kpiSections.snapshot}
        attentionTitle="Needs attention"
        snapshotTitle={isExecutive ? "Org-wide snapshot" : "My groups"}
      />

      {quickActions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-bold text-accent uppercase tracking-wider">
            Quick actions
          </h2>
          <div
            className={`grid grid-cols-1 gap-2 ${
              quickActions.length >= 3
                ? "sm:grid-cols-3"
                : quickActions.length === 2
                  ? "sm:grid-cols-2"
                  : ""
            }`}
          >
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <QuickActionLink key={action.key} href={action.href}>
                  <Icon className="h-5 w-5 shrink-0" />
                  {action.label}
                </QuickActionLink>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section id="dashboard-committees" className="space-y-2 lg:col-span-2">
          {isExecutive ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-accent">
                  {supervisoryLabel} timeline
                </h2>
                <div className="flex items-center gap-1 rounded-lg border border-charcoal/10 bg-slate-100 p-0.5">
                  <button
                    type="button"
                    onClick={() => setViewMode("gantt")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      viewMode === "gantt"
                        ? "bg-white text-charcoal shadow-sm"
                        : "text-muted hover:text-charcoal"
                    }`}
                  >
                    Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                      viewMode === "cards"
                        ? "bg-white text-charcoal shadow-sm"
                        : "text-muted hover:text-charcoal"
                    }`}
                  >
                    Cards
                  </button>
                </div>
              </div>
              {viewMode === "gantt" ? (
                <GanttChart items={timelineGoals} />
              ) : (
                committeeCards
              )}
            </>
          ) : (
            <>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-accent">
                {`My ${committeeLabel.toLowerCase()}s`}
              </h2>
              {committeeCards}
            </>
          )}
        </section>

        <section id="dashboard-alerts" className="min-w-0 lg:col-span-1">
          <AlertFeed alerts={alerts} onAlertClick={handleAlertClick} />
        </section>
      </div>
    </div>
  );
}
