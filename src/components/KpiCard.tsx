"use client";

import Link from "next/link";

type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "lime" | "gold" | "charcoal";
  href?: string;
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

export function KpiCard({
  label,
  value,
  hint,
  accent = "charcoal",
  href,
}: KpiCardProps) {
  const inner = (
    <>
      <p className={`text-[11px] uppercase tracking-wider ${LABEL_TEXT[accent]}`}>{label}</p>
      <p className="text-xl font-bold text-charcoal mt-0.5 tracking-tight tabular-nums">{value}</p>
      {hint && <p className="text-xs mt-0.5 text-muted font-medium leading-snug">{hint}</p>}
    </>
  );

  const className = `rounded-xl px-3 py-2.5 transition-transform block ${ACCENT[accent]} ${
    href ? "cursor-pointer hover:border-primary/40" : ""
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
