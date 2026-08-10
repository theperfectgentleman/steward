"use client";

import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/types";

export type StatusCounts = Partial<Record<TaskStatus, number>> & {
  total?: number;
};

const SEGMENT_ORDER: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
  "BLOCKED",
];

const SEGMENT_BAR: Record<TaskStatus, string> = {
  TODO: "bg-charcoal/35",
  IN_PROGRESS: "bg-primary",
  IN_REVIEW: "bg-amber-500",
  DONE: "bg-primary-dark",
  BLOCKED: "bg-accent",
};

const SEGMENT_DOT: Record<TaskStatus, string> = {
  TODO: "bg-charcoal/40",
  IN_PROGRESS: "bg-primary",
  IN_REVIEW: "bg-amber-500",
  DONE: "bg-primary-dark",
  BLOCKED: "bg-accent",
};

type Props = {
  counts: StatusCounts;
  /** Compact: bar + minimal legend (e.g. Home cards). Default: larger panel. */
  compact?: boolean;
  className?: string;
  title?: string;
};

function resolveCounts(counts: StatusCounts) {
  const byStatus = SEGMENT_ORDER.map((status) => ({
    status,
    count: counts[status] ?? 0,
    label: TASK_STATUS_LABELS[status],
  }));
  const total =
    counts.total ?? byStatus.reduce((sum, s) => sum + s.count, 0);
  return { byStatus, total };
}

export function TaskStatusBreakdown({
  counts,
  compact = false,
  className = "",
  title = "Status breakdown",
}: Props) {
  const { byStatus, total } = resolveCounts(counts);
  const visible = byStatus.filter((s) => s.count > 0);

  if (compact) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <div
          className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex"
          role="img"
          aria-label={
            total
              ? `${total} items: ${byStatus
                  .map((s) => `${s.count} ${s.label}`)
                  .join(", ")}`
              : "No work"
          }
        >
          {total === 0 ? null : visible.length === 0 ? (
            <div className="h-full w-full bg-slate-200" />
          ) : (
            visible.map((s) => (
              <div
                key={s.status}
                className={`h-full ${SEGMENT_BAR[s.status]} min-w-[2px]`}
                style={{ width: `${(s.count / total) * 100}%` }}
                title={`${s.label}: ${s.count}`}
              />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      className={`rounded-xl border border-charcoal/10 bg-white px-3 py-3 shadow-xs space-y-2.5 ${className}`}
      aria-labelledby="task-status-breakdown-title"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3
          id="task-status-breakdown-title"
          className="text-[11px] font-bold text-accent uppercase tracking-wider"
        >
          {title}
        </h3>
        <span className="text-xs font-semibold text-muted tabular-nums">
          {total} total
        </span>
      </div>

      <div
        className="h-4 w-full rounded-lg bg-slate-100 overflow-hidden flex touch-manipulation"
        role="img"
        aria-label={
          total
            ? `${total} items: ${byStatus
                .map((s) => `${s.count} ${s.label}`)
                .join(", ")}`
            : "No work yet"
        }
      >
        {total === 0 ? (
          <div className="h-full w-full bg-slate-200/80" />
        ) : (
          visible.map((s) => (
            <div
              key={s.status}
              className={`h-full ${SEGMENT_BAR[s.status]} min-w-[4px] transition-[width]`}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          ))
        )}
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {byStatus.map((s) => (
          <li
            key={s.status}
            className="flex items-center gap-1.5 min-w-0 rounded-lg px-1.5 py-1"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full shrink-0 ${SEGMENT_DOT[s.status]}`}
              aria-hidden
            />
            <span className="text-[11px] text-muted truncate">{s.label}</span>
            <span className="ml-auto text-xs font-bold text-charcoal tabular-nums">
              {s.count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Build counts from a list of task-like objects with a status field. */
export function countsFromTasks(
  tasks: { status: TaskStatus }[],
): StatusCounts {
  const counts: StatusCounts = {
    TODO: 0,
    IN_PROGRESS: 0,
    IN_REVIEW: 0,
    DONE: 0,
    BLOCKED: 0,
    total: tasks.length,
  };
  for (const t of tasks) {
    counts[t.status] = (counts[t.status] ?? 0) + 1;
  }
  return counts;
}
