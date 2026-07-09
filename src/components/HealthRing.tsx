"use client";

type HealthRingProps = {
  label: string;
  completed: number;
  total: number;
  blocked?: number;
};

export function HealthRing({ label, completed, total, blocked = 0 }: HealthRingProps) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl border border-charcoal/10">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="#F8FAFC"
            strokeWidth="10"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            fill="none"
            stroke="#84CC16"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-charcoal">{pct}%</span>
        </div>
      </div>
      <p className="text-sm font-semibold text-charcoal text-center leading-tight">
        {label}
      </p>
      <p className="text-xs text-muted">
        {completed}/{total} done
        {blocked > 0 && (
          <span className="text-accent font-medium"> · {blocked} blocked</span>
        )}
      </p>
    </div>
  );
}
