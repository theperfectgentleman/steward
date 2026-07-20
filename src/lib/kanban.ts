import type { TaskStatus } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/types";

export const KANBAN_COLUMNS: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
];

/** @deprecated Prefer LIST_STATUS_META for the dense list UI */
export const COLUMN_META: Record<
  TaskStatus,
  { label: string; dot: string; header: string; border: string }
> = {
  TODO: {
    label: TASK_STATUS_LABELS.TODO,
    dot: "bg-charcoal/30",
    header: "bg-slate-50/60",
    border: "border-charcoal/5",
  },
  IN_PROGRESS: {
    label: TASK_STATUS_LABELS.IN_PROGRESS,
    dot: "bg-primary",
    header: "bg-slate-50/60",
    border: "border-primary/20",
  },
  BLOCKED: {
    label: TASK_STATUS_LABELS.BLOCKED,
    dot: "bg-accent",
    header: "bg-slate-50/60",
    border: "border-accent/20",
  },
  DONE: {
    label: TASK_STATUS_LABELS.DONE,
    dot: "bg-primary-dark",
    header: "bg-slate-50/60",
    border: "border-primary-dark/20",
  },
};

/** Dense list status pills (inspiration: Not Started / In Progress groups) */
export const LIST_STATUS_META: Record<
  TaskStatus,
  { label: string; pill: string; icon: string }
> = {
  TODO: {
    label: "Not Started",
    pill: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/80",
    icon: "bg-rose-500",
  },
  IN_PROGRESS: {
    label: "In Progress",
    pill: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/80",
    icon: "bg-amber-500",
  },
  BLOCKED: {
    label: "Awaiting",
    pill: "bg-orange-50 text-orange-800 ring-1 ring-orange-200/80",
    icon: "bg-orange-500",
  },
  DONE: {
    label: "Done",
    pill: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80",
    icon: "bg-primary",
  },
};
