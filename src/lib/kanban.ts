import type { TaskStatus } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/types";

export const KANBAN_COLUMNS: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
];

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
