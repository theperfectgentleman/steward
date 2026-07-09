"use client";

import { useEffect, useState } from "react";
import { HealthRing } from "@/components/HealthRing";
import { AlertFeed, type AlertItem } from "@/components/AlertFeed";
import { TouchButton } from "@/components/TouchButton";
import { FeedbackSubmitSheet } from "@/components/FeedbackSubmitSheet";
import { useApp } from "@/providers/AppProvider";
import { canViewAllCommittees } from "@/lib/types";
import { FileDown } from "lucide-react";

type CommitteeStat = {
  id: string;
  charterLetter: string;
  name: string;
  total: number;
  done: number;
  blocked: number;
};

export function DashboardView() {
  const { user, activeCommitteeId } = useApp();
  const [stats, setStats] = useState<CommitteeStat[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const isExecutive = user && canViewAllCommittees(user.role);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats ?? []);
        setAlerts(
          (data.alerts ?? []).map((a: AlertItem & { time: string }) => ({
            ...a,
            time: new Date(a.time).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
          })),
        );
      })
      .catch(() => undefined);
  }, [activeCommitteeId]);

  const filteredStats = isExecutive
    ? stats
    : stats.filter((s) => s.id === activeCommitteeId);

  const totals = filteredStats.reduce(
    (acc, s) => ({
      total: acc.total + s.total,
      done: acc.done + s.done,
      blocked: acc.blocked + s.blocked,
    }),
    { total: 0, done: 0, blocked: 0 },
  );

  const handleExport = () => {
    const lines = [
      "UnityCommit — Monthly Presbytery Report",
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
      ...stats.map(
        (s) =>
          `${s.charterLetter.toUpperCase()}) ${s.name}: ${s.done}/${s.total} tasks complete, ${s.blocked} blocked`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "presbytery-report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-charcoal">
          {isExecutive ? "Presbytery Dashboard" : "Committee Dashboard"}
        </h1>
        <p className="text-muted mt-1">
          {isExecutive
            ? "Real-time view across all 19 committees"
            : "Your committee at a glance"}
        </p>
      </div>

      <FeedbackSubmitSheet />

      {isExecutive && (
        <TouchButton size="lg" className="w-full sm:w-auto" onClick={handleExport}>
          <FileDown className="h-5 w-5" />
          Export Monthly Presbytery Report
        </TouchButton>
      )}

      <div className="dashboard-grid dashboard-split space-y-4 lg:space-y-0">
        <section className="space-y-4">
          <h2 className="text-sm font-bold text-accent uppercase tracking-wide">
            Progress Health
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <HealthRing
              label="Overall Progress"
              completed={totals.done}
              total={totals.total}
              blocked={totals.blocked}
            />
            {isExecutive &&
              filteredStats.slice(0, 5).map((s) => (
                <HealthRing
                  key={s.id}
                  label={s.name}
                  completed={s.done}
                  total={s.total}
                  blocked={s.blocked}
                />
              ))}
          </div>
        </section>

        <section className="lg:col-span-1 space-y-4">
          <h2 className="text-sm font-bold text-accent uppercase tracking-wide">
            Alert Feed
          </h2>
          <AlertFeed alerts={alerts} />
        </section>
      </div>
    </div>
  );
}
