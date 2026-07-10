export type UserRole =
  | "SUPER_ADMIN"
  | "CHURCH_EXECUTIVE"
  | "COMMITTEE_CHAIRPERSON"
  | "COMMITTEE_SECRETARY"
  | "COMMITTEE_MEMBER";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  CHURCH_EXECUTIVE: "Church Executive",
  COMMITTEE_CHAIRPERSON: "Committee Chairperson",
  COMMITTEE_SECRETARY: "Committee Secretary",
  COMMITTEE_MEMBER: "Committee Member",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export const TASK_STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
];

/** Chair / Secretary / Super Admin — create, assign, edit tasks & schedules */
export function canEditTasks(role: UserRole): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "COMMITTEE_CHAIRPERSON" ||
    role === "COMMITTEE_SECRETARY"
  );
}

/** Chair / Secretary / Super Admin — log meetings & attendance */
export function canLogMinutes(role: UserRole): boolean {
  return canEditTasks(role);
}

/** Chair / Super Admin — formally approve filed minutes */
export function canApproveMinutes(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "COMMITTEE_CHAIRPERSON";
}

export function canViewAllCommittees(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "CHURCH_EXECUTIVE";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

/** Executives are read-only; everyone else may RSVP to events */
export function canRsvp(role: UserRole): boolean {
  return role !== "CHURCH_EXECUTIVE";
}

export function canReviewFeedback(role: UserRole): boolean {
  return canViewAllCommittees(role) || canEditTasks(role);
}

export function isReadOnlyExecutive(role: UserRole): boolean {
  return role === "CHURCH_EXECUTIVE";
}
