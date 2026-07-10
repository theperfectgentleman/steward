"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertFeed, type AlertItem } from "@/components/AlertFeed";
import { KpiCard } from "@/components/KpiCard";
import { TouchButton } from "@/components/TouchButton";
import { FeedbackSubmitSheet } from "@/components/FeedbackSubmitSheet";
import { FeedbackReviewSheet } from "@/components/FeedbackReviewSheet";
import { useApp } from "@/providers/AppProvider";
import {
  canReviewFeedback,
  canViewAllCommittees,
} from "@/lib/types";
import { buildTextPdf } from "@/lib/pdf";
import { committeePath } from "@/lib/navigation";
import { FileDown, ChevronRight } from "lucide-react";

type CommitteeStat = {
  id: string;
  charterLetter: string;
  name: string;
  total: number;
  done: number;
  blocked: number;
  meetingCount?: number;
};

export function OverallDashboardView() {
  const router = useRouter();
  const { user } = useApp();
  const [stats, setStats] = useState<CommitteeStat[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const isExecutive = user && canViewAllCommittees(user.role);
  const canReview = user && canReviewFeedback(user.role);

  const loadDashboard = useCallback(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats ?? []);
        setAlerts(
          (data.alerts ?? []).map((a: AlertItem & { time: string }) => ({
            ...a,
            href: a.committeeId
              ? committeePath(
                  a.committeeId,
                  a.type === "minutes"
                    ? "minutes"
                    : a.type === "blocked" || a.type === "completed"
                      ? "tasks"
                      : undefined,
                )
              : a.href,
            time: new Date(a.time).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
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

  const handleExport = () => {
    const lines = [
      `Generated: ${new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })}`,
      "",
      "Committee Progress Summary",
      "-------------------------",
      ...stats.map((s) => {
        const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
        return `${s.charterLetter.toUpperCase()}) ${s.name}: ${s.done}/${s.total} complete (${pct}%), ${s.blocked} blocked`;
      }),
      "",
      `Overall: ${totals.done}/${totals.total} tasks complete, ${totals.blocked} blocked`,
    ];
    const blob = buildTextPdf("UnityCommit — Monthly Presbytery Report", lines);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `presbytery-report-${new Date().toISOString().slice(0, 7)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAlertClick = (alert: AlertItem) => {
    if (alert.committeeId) {
      localStorage.setItem("unitycommit-committee", alert.committeeId);
      router.push(alert.href ?? committeePath(alert.committeeId));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">
          {isExecutive ? "Presbytery Dashboard" : "Overall Dashboard"}
        </h1>
        <p className="text-muted mt-1">
          {isExecutive
            ? "Real-time view across all 19 committees"
            : "Your committees at a glance"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Committees" value={stats.length} accent="gold" />
        <KpiCard
          label="Tasks Complete"
          value={`${totals.done}/${totals.total}`}
          hint={totals.total ? `${Math.round((totals.done / totals.total) * 100)}% overall` : undefined}
          accent="lime"
        />
        <KpiCard
          label="Blocked"
          value={totals.blocked}
          hint={totals.blocked > 0 ? "Needs attention" : "All clear"}
          accent={totals.blocked > 0 ? "gold" : "charcoal"}
        />
        <KpiCard
          label="Pending Minutes"
          value={pendingMinutes}
          accent="charcoal"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <FeedbackSubmitSheet />
        {canReview && <FeedbackReviewSheet />}
      </div>

      {isExecutive && (
        <TouchButton size="lg" className="w-full sm:w-auto" onClick={handleExport}>
          <FileDown className="h-5 w-5" />
          Export Monthly Presbytery Report
        </TouchButton>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-bold text-accent uppercase tracking-wide">
            Committees
          </h2>
          <div className="bg-white rounded-2xl border border-charcoal/10 overflow-hidden">
            <ul className="divide-y divide-charcoal/10">
              {stats.map((s) => {
                const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
                return (
                  <li key={s.id}>
                    <Link
                      href={committeePath(s.id)}
                      onClick={() => localStorage.setItem("unitycommit-committee", s.id)}
                      className="flex items-center gap-4 p-4 hover:bg-surface transition-colors touch-target-lg"
                    >
                      <span className="w-10 h-10 flex items-center justify-center rounded-xl bg-accent/10 text-accent font-bold uppercase shrink-0">
                        {s.charterLetter}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-charcoal truncate">{s.name}</p>
                        <div className="mt-2 h-2 rounded-full bg-surface overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted mt-1">
                          {s.done}/{s.total} tasks · {s.blocked} blocked
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
            {stats.length === 0 && (
              <p className="text-center text-muted py-8">No committee data yet.</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-bold text-accent uppercase tracking-wide">
            Alert Feed
          </h2>
          <AlertFeed alerts={alerts} onAlertClick={handleAlertClick} />
        </section>
      </div>
    </div>
  );
}
