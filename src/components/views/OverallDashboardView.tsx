"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, FileText, MessageSquarePlus } from "lucide-react";
import { AlertFeed, type AlertItem } from "@/components/AlertFeed";
import { MyWorkHub } from "@/components/MyWorkHub";
import { DashboardStatsPanel } from "@/components/DashboardStatsPanel";
import { QuickActionLink } from "@/components/QuickActionLink";
import { useApp } from "@/providers/AppProvider";
import { toPermissionUser } from "@/lib/permissions-client";
import {
  canCreatePresbyteryAssignment,
  canViewAllCommittees,
} from "@/lib/types";
import { formatDate } from "@/lib/dates";
import { buildOverallDashboardStats } from "@/lib/dashboard-kpis";
import { assignWorkPath, committeePath, documentsPath, suggestionsPath } from "@/lib/navigation";

type CommitteeStat = {
  id: string;
  charterLetter: string;
  name: string;
  total: number;
  done: number;
  blocked: number;
  activeProjects?: number;
  meetingCount?: number;
};

type PipelineRow = { status: string; _count: number };

export function OverallDashboardView() {
  const router = useRouter();
  const { user } = useApp();
  const [stats, setStats] = useState<CommitteeStat[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [pipeline, setPipeline] = useState<PipelineRow[]>([]);
  const [awaitingClose, setAwaitingClose] = useState<
    { id: string; title: string; targetCommittee: { id: string; name: string } }[]
  >([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState(0);

  const perm = user ? toPermissionUser(user) : null;
  const isExecutive = perm && canViewAllCommittees(perm);
  const canAssign = perm && canCreatePresbyteryAssignment(perm);

  const loadDashboard = useCallback(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats ?? []);
        setPipeline(data.assignmentPipeline ?? []);
        setAwaitingClose(data.awaitingMyClose ?? []);
        setAssignmentDrafts(data.myAssignmentDrafts ?? 0);
        setAlerts(
          (data.alerts ?? []).map((a: AlertItem & { time: string; href?: string }) => ({
            ...a,
            href:
              a.href ??
              (a.committeeId
                ? committeePath(
                    a.committeeId,
                    a.type === "minutes"
                      ? "minutes"
                      : a.type === "blocked" || a.type === "completed"
                        ? "tasks"
                        : undefined,
                  )
                : undefined),
            time: formatDate(a.time),
          })),
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
  const openAssignments = pipeline
    .filter((p) => !["CLOSED", "CANCELLED"].includes(p.status))
    .reduce((n, p) => n + p._count, 0);

  const kpiSections = buildOverallDashboardStats({
    stats,
    alerts,
    totals,
    pendingMinutes,
    openAssignments,
    awaitingCloseCount: awaitingClose.length,
    assignmentDrafts,
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

  const quickActions = [
    canAssign
      ? {
          key: "assign",
          href: assignWorkPath(),
          label: "Assign work",
          icon: ClipboardCheck,
        }
      : null,
    {
      key: "suggestions",
      href: suggestionsPath(),
      label: "Suggestions",
      icon: MessageSquarePlus,
    },
    user?.role !== "ORG_TECH"
      ? {
          key: "documents",
          href: documentsPath(),
          label: "Documents",
          icon: FileText,
        }
      : null,
  ].filter((action): action is { key: string; href: string; label: string; icon: typeof FileText } => action != null);

  return (
    <div className="space-y-4">
      <MyWorkHub />

      <div>
        <h1 className="text-xl font-bold text-charcoal">
          {isExecutive ? "Presbytery Dashboard" : "Overall Dashboard"}
        </h1>
        <p className="text-sm text-muted mt-0.5">
          {isExecutive
            ? "Real-time view across all 19 committees"
            : "Your committees at a glance"}
        </p>
      </div>

      <DashboardStatsPanel
        attention={kpiSections.attention}
        snapshot={kpiSections.snapshot}
        attentionTitle="Needs your attention"
        snapshotTitle={isExecutive ? "Church-wide snapshot" : "At a glance"}
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

      {isExecutive && awaitingClose.length > 0 && (
        <section
          id="dashboard-awaiting-close"
          className="rounded-xl border border-accent/30 bg-accent/5 px-3 py-2.5 space-y-2"
        >
          <h2 className="text-[11px] font-bold text-accent uppercase tracking-wider">
            Awaiting my close ({awaitingClose.length})
          </h2>
          <ul className="space-y-1">
            {awaitingClose.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/assignments/${a.id}?action=close`}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white border border-charcoal/10 px-3 py-2 hover:border-primary/40"
                >
                  <span className="text-sm font-semibold text-charcoal truncate">{a.title}</span>
                  <span className="text-[11px] text-muted shrink-0">
                    {a.targetCommittee?.name ?? "Personal"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <section id="dashboard-committees" className="lg:col-span-2 space-y-2">
          <h2 className="text-[11px] font-bold text-accent uppercase tracking-wider">
            Committees
          </h2>
          {stats.length === 0 ? (
            <p className="text-center text-muted py-6 rounded-xl border border-charcoal/5 bg-white text-sm">
              No committee data yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stats.map((s) => {
                const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                return (
                  <Link
                    key={s.id}
                    href={committeePath(s.id)}
                    onClick={() => localStorage.setItem("unitycommit-committee", s.id)}
                    className="flex flex-col gap-1.5 rounded-xl border border-charcoal/5 bg-white px-3 py-2.5 shadow-xs hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent/10 border border-accent/20 text-accent font-extrabold uppercase shrink-0 text-xs">
                        {s.charterLetter}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-semibold text-charcoal text-sm leading-snug line-clamp-2">
                            {s.name}
                          </p>
                          <span className="text-xs font-bold text-charcoal shrink-0 tabular-nums">{pct}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted font-medium">
                      {s.done}/{s.total} tasks · {s.blocked} awaiting
                      {s.activeProjects != null && ` · ${s.activeProjects} projects`}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section id="dashboard-alerts" className="space-y-2">
          <h2 className="text-[11px] font-bold text-accent uppercase tracking-wider">
            Alert Feed
          </h2>
          <AlertFeed alerts={alerts} onAlertClick={handleAlertClick} />
        </section>
      </div>
    </div>
  );
}
