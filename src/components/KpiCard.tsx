"use client";

type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "lime" | "gold" | "charcoal";
};

const ACCENT = {
  lime: "bg-white border-l-4 border-l-primary border-y border-r border-charcoal/5 shadow-xs",
  gold: "bg-white border-l-4 border-l-accent border-y border-r border-charcoal/5 shadow-xs",
  charcoal: "bg-white border-l-4 border-l-charcoal-muted border-y border-r border-charcoal/5 shadow-xs",
};

const LABEL_TEXT = {
  lime: "text-primary-dark font-bold",
  gold: "text-accent font-bold",
  charcoal: "text-charcoal-muted font-bold",
};

export function KpiCard({ label, value, hint, accent = "charcoal" }: KpiCardProps) {
  return (
    <div
      className={`rounded-2xl p-5 transition-transform hover:-translate-y-0.5 ${ACCENT[accent]}`}
    >
      <p className={`text-xs uppercase tracking-wider ${LABEL_TEXT[accent]}`}>{label}</p>
      <p className="text-3xl font-extrabold text-charcoal mt-1 tracking-tight">{value}</p>
      {hint && <p className="text-xs mt-1.5 text-muted font-medium">{hint}</p>}
    </div>
  );
}
