"use client";

type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "lime" | "gold" | "charcoal";
};

const ACCENT = {
  lime: "bg-primary/15 text-primary-dark border-primary/30",
  gold: "bg-accent/10 text-accent border-accent/30",
  charcoal: "bg-charcoal/5 text-charcoal border-charcoal/15",
};

export function KpiCard({ label, value, hint, accent = "charcoal" }: KpiCardProps) {
  return (
    <div
      className={`rounded-2xl border p-5 ${ACCENT[accent]}`}
    >
      <p className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {hint && <p className="text-xs mt-1 opacity-70">{hint}</p>}
    </div>
  );
}
