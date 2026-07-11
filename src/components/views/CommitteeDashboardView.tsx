"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HealthRing } from "@/components/HealthRing";
import { KpiCard } from "@/components/KpiCard";
import { AlertFeed, type AlertItem } from "@/components/AlertFeed";
import { FeedbackSubmitSheet } from "@/components/FeedbackSubmitSheet";
import { FeedbackReviewSheet } from "@/components/FeedbackReviewSheet";
import { useApp } from "@/providers/AppProvider";
import { useCommitteeContext } from "@/hooks/useCommitteeContext";
import { canReviewFeedback, canViewAllCommittees } from "@/lib/types";
import { committeePath } from "@/lib/navigation";
import {
  Calendar,
  ClipboardList,
  FileText,
} from "lucide-react";

type CommitteeStat = {
  total: number;
  done: number;
  blocked: number;
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
};

export function CommitteeDashboardView() {
  const { user } = useApp();
  const { committeeId, committee, loading } = useCommitteeContext();
  const [stats, setStats] = useState<CommitteeStat | null>(null);
  const [meta, setMeta] = useState<CommitteeMeta | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [tasks, setTasks] = useState<TaskPreview[]>([]);
  const canReview = user && canReviewFeedback(user.role);

  const load = useCallback(() => {
    if (!committeeId) return;

    fetch(`/api/dashboard?committeeId=${committeeId}`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.stats?.[0];
        if (s) {
          setStats({ total: s.total, done: s.done, blocked: s.blocked });
        }
        setAlerts(
          (data.alerts ?? []).map((a: AlertItem & { time: string }) => ({
            ...a,
            href: committeePath(
              committeeId,
              a.type === "minutes"
                ? "minutes"
                : a.type === "blocked" || a.type === "completed"
                  ? "tasks"
                  : undefined,
            ),
            time: new Date(a.time).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
          })),
        );
      })
      .catch(() => undefined);

    const scope =
      user && canViewAllCommittees(user.role) ? "all" : user?.id ?? "";
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
    return <p className="text-muted text-center py-12">Loading committee…</p>;
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
            {meta.budget != null && ` · Budget $${meta.budget.toLocaleString()}`}
          </p>
        )}
        {meta?.description && (
          <p className="text-sm text-muted mt-2">{meta.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Tasks Done"
          value={stats ? `${stats.done}/${stats.total}` : "—"}
          accent="lime"
        />
        <KpiCard
          label="Blocked"
          value={stats?.blocked ?? 0}
          accent={stats && stats.blocked > 0 ? "gold" : "charcoal"}
        />
        <KpiCard label="Open Tasks" value={stats ? stats.total - stats.done : "—"} />
        <KpiCard label="Alerts" value={alerts.length} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {shortcuts.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2.5 p-5 rounded-2xl bg-white border border-charcoal/5 shadow-xs hover:border-primary/50 hover:shadow-sm touch-target-lg transition-all"
          >
            <Icon className="h-6 w-6 text-accent" />
            <span className="text-sm font-semibold text-charcoal">{label}</span>
          </Link>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <FeedbackSubmitSheet committeeId={committeeId} />
        {canReview && <FeedbackReviewSheet committeeId={committeeId} />}
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
