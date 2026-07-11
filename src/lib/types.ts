export type UserRole =
  | "SUPER_ADMIN"
  | "SYSTEM_ADMIN"
  | "CHURCH_EXECUTIVE"
  | "COMMITTEE_PARTICIPANT";

export type CommitteeTitle = "CHAIR" | "SECRETARY" | "MEMBER";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETE";

export type AssignmentSource = "PRESBYTERY" | "COMMITTEE_REFERRAL";

export type AssignmentStatus =
  | "DRAFT"
  | "ASSIGNED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "RETURNED"
  | "CHAIR_APPROVED"
  | "CLOSED"
  | "CANCELLED";

export type AssignmentPriority = "LOW" | "NORMAL" | "HIGH";

export type EntityType = "ASSIGNMENT" | "PROJECT" | "TASK";

export type AttentionUrgency = "NOW" | "SOON" | "WAITING" | "FYI";

export type AttentionKind =
  | "TASK"
  | "ASSIGNMENT"
  | "REVIEW"
  | "REFERRAL"
  | "MINUTES"
  | "COMMENT";

export type CommitteeMembership = {
  committeeId: string;
  title: CommitteeTitle;
};

export type AppSettings = {
  committeeBudgetsEnabled: boolean;
};

export type PermissionUser = {
  id: string;
  role: UserRole;
  committeeMemberships: CommitteeMembership[];
  presbyteryMembership?: { isHead: boolean } | null;
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  SYSTEM_ADMIN: "System Admin",
  CHURCH_EXECUTIVE: "Presbytery",
  COMMITTEE_PARTICIPANT: "Committee Member",
};

export const COMMITTEE_TITLE_LABELS: Record<CommitteeTitle, string> = {
  CHAIR: "Chair",
  SECRETARY: "Secretary",
  MEMBER: "Member",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Awaiting",
  DONE: "Done",
};

export const TASK_STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "DONE",
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETE: "Complete",
};

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  DRAFT: "Draft",
  ASSIGNED: "Assigned",
  ACCEPTED: "Accepted",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  RETURNED: "Returned",
  CHAIR_APPROVED: "Chair Approved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const ASSIGNMENT_PRIORITY_LABELS: Record<AssignmentPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
};

export function getCommitteeTitle(
  user: PermissionUser,
  committeeId: string,
): CommitteeTitle | null {
  const membership = user.committeeMemberships.find(
    (m) => m.committeeId === committeeId,
  );
  return membership?.title ?? null;
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

export function isSystemAdmin(role: UserRole): boolean {
  return role === "SYSTEM_ADMIN";
}

export function isPresbyteryMember(user: PermissionUser): boolean {
  return (
    user.role === "CHURCH_EXECUTIVE" || user.presbyteryMembership != null
  );
}

export function isPresbyteryHead(user: PermissionUser): boolean {
  return user.presbyteryMembership?.isHead === true;
}

export function canViewAllCommittees(user: PermissionUser): boolean {
  return (
    isSuperAdmin(user.role) ||
    user.role === "CHURCH_EXECUTIVE" ||
    isSystemAdmin(user.role)
  );
}

export function canManageUsers(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN";
}

export function canInviteMembers(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (canManageUsers(user.role)) return true;
  return getCommitteeTitle(user, committeeId) === "CHAIR";
}

export function canManageCommitteeConfig(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN";
}

export function canManagePresbyteryRoster(role: UserRole): boolean {
  return role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN";
}

/** File downloads only. SYSTEM_ADMIN is always denied. */
export function canReadDocuments(
  user: PermissionUser,
  committeeId?: string,
): boolean {
  if (user.role === "SYSTEM_ADMIN") return false;
  if (user.role === "SUPER_ADMIN" || user.role === "CHURCH_EXECUTIVE") return true;
  if (!committeeId) return false;
  return getCommitteeTitle(user, committeeId) != null;
}

export function canEditTasks(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isSuperAdmin(user.role)) return true;
  const title = getCommitteeTitle(user, committeeId);
  return title === "CHAIR" || title === "SECRETARY";
}

export function canLogMinutes(
  user: PermissionUser,
  committeeId: string,
): boolean {
  return canEditTasks(user, committeeId);
}

export function canApproveMinutes(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isSuperAdmin(user.role)) return true;
  return getCommitteeTitle(user, committeeId) === "CHAIR";
}

export function canAcceptAssignments(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isSuperAdmin(user.role)) return true;
  const title = getCommitteeTitle(user, committeeId);
  return title === "CHAIR" || title === "SECRETARY";
}

export function canApproveAssignmentReview(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isSuperAdmin(user.role)) return true;
  if (getCommitteeTitle(user, committeeId) === "CHAIR") return true;
  return isPresbyteryHead(user);
}

export function canCreatePresbyteryAssignment(user: PermissionUser): boolean {
  return isSuperAdmin(user.role) || isPresbyteryMember(user);
}

export function canCreateReferral(
  user: PermissionUser,
  sourceCommitteeId: string,
): boolean {
  if (isSuperAdmin(user.role)) return true;
  return getCommitteeTitle(user, sourceCommitteeId) === "CHAIR";
}

export function canCloseAssignment(
  user: PermissionUser,
  createdById: string,
): boolean {
  if (isSuperAdmin(user.role)) return true;
  return user.id === createdById;
}

export function canRsvp(user: PermissionUser): boolean {
  return user.role !== "CHURCH_EXECUTIVE" || user.committeeMemberships.length > 0;
}

export function canReviewFeedback(
  user: PermissionUser,
  committeeId?: string,
): boolean {
  if (canViewAllCommittees(user)) return true;
  if (!committeeId) return false;
  return canEditTasks(user, committeeId);
}

/** Block Presbytery from committee-internal mutations unless they hold a committee title. */
export function isCommitteeReadOnly(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isSuperAdmin(user.role)) return false;
  if (user.role !== "CHURCH_EXECUTIVE") return false;
  return getCommitteeTitle(user, committeeId) == null;
}

export function assertCommitteeMutationAllowed(
  user: PermissionUser,
  committeeId: string,
): boolean {
  return !isCommitteeReadOnly(user, committeeId);
}

/** @deprecated use isCommitteeReadOnly */
export function isReadOnlyExecutive(role: UserRole): boolean {
  return role === "CHURCH_EXECUTIVE";
}
