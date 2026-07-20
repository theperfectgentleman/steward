import type { AssignmentStatus, ReportStatus } from "@/lib/types";

/** Steward-themed status chips (primary emerald, accent gold, charcoal neutrals). */
export function assignmentStatusChip(status: string): string {
  const map: Record<string, string> = {
    DRAFT: "bg-stone-100 text-stone-600",
    ASSIGNED: "bg-charcoal/8 text-charcoal",
    ACCEPTED: "bg-primary/15 text-primary-dark",
    IN_PROGRESS: "bg-accent/15 text-accent",
    IN_REVIEW: "bg-sky-100 text-sky-900",
    RETURNED: "bg-amber-100 text-amber-900",
    CHAIR_APPROVED: "bg-primary/20 text-primary-dark",
    CLOSED: "bg-primary text-white",
    CANCELLED: "bg-stone-200 text-stone-500",
  };
  return map[status] ?? "bg-surface text-muted";
}

export function reportStatusChip(status: ReportStatus | string): string {
  const map: Record<string, string> = {
    DRAFT: "bg-stone-100 text-stone-600",
    SUBMITTED: "bg-accent/15 text-accent",
    RETURNED: "bg-amber-100 text-amber-900",
    FINAL: "bg-primary text-white",
  };
  return map[status] ?? "bg-surface text-muted";
}

export function isOpenAssignmentStatus(status: string) {
  return ![
    "CLOSED",
    "CANCELLED",
  ].includes(status);
}

export function isReviewAssignmentStatus(status: string) {
  return status === "IN_REVIEW" || status === "CHAIR_APPROVED";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export type AssignmentStatusKey = AssignmentStatus;
