"use client";

import Link from "next/link";

export type DashboardStat = {
  key: string;
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  accent?: "lime" | "gold" | "charcoal";
  /** Highlights when the count needs attention */
  active?: boolean;
};

export function DashboardStatGrid({
  stats,
  size = "default",
}: {
  stats: DashboardStat[];
  size?: "default" | "compact";
}) {
  if (stats.length === 0) return null;

  const gridClass =
    size === "compact"
      ? "grid grid-cols-2 gap-3"
      : "grid grid-cols-2 gap-3 lg:grid-cols-3";

  return (
    <div className={gridClass}>
      {stats.map(({ key, ...stat }) => (
        <StatCard key={key} {...stat} />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  href,
  accent = "charcoal",
  active = false,
}: DashboardStat) {
  const accentStyles = {
    lime: active
      ? "border-l-primary bg-white"
      : "border-l-primary/40 bg-white",
    gold: active
      ? "border-l-accent bg-accent/5"
      : "border-l-accent/30 bg-white",
    charcoal: "border-l-charcoal/20 bg-white",
  };

  const labelStyles = {
    lime: "text-primary-dark",
    gold: "text-accent",
    charcoal: "text-charcoal-muted",
  };

  const inner = (
    <>
      <p
        className={`text-xs font-bold uppercase tracking-wider ${labelStyles[accent]}`}
      >
        {label}
      </p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-charcoal">
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-xs font-medium text-muted">{hint}</p>
      )}
    </>
  );

  const className = `block rounded-2xl border border-charcoal/8 border-l-4 p-5 shadow-xs transition-all ${accentStyles[accent]} ${
    href
      ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
      : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

export function DashboardStatsPanel({
  attention,
  snapshot,
  attentionTitle = "Needs your attention",
  snapshotTitle = "Church-wide snapshot",
}: {
  attention: DashboardStat[];
  snapshot: DashboardStat[];
  attentionTitle?: string;
  snapshotTitle?: string;
}) {
  const attentionTotal = attention.reduce((n, s) => {
    const v = typeof s.value === "number" ? s.value : 0;
    return n + v;
  }, 0);

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-accent">
            {attentionTitle}
          </h2>
          {attentionTotal === 0 && (
            <p className="text-xs font-medium text-muted">All clear</p>
          )}
        </div>
        {attention.length === 0 ? (
          <p className="text-sm text-muted rounded-xl border border-charcoal/8 bg-surface/50 px-4 py-3">
            Nothing needs your sign-off right now. Check the snapshot below for
            church-wide progress.
          </p>
        ) : (
          <DashboardStatGrid stats={attention} />
        )}
      </section>

      {snapshot.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-charcoal-muted">
            {snapshotTitle}
          </h2>
          <DashboardStatGrid stats={snapshot} />
        </section>
      )}
    </div>
  );
}
