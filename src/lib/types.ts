export type UserRole = "ORG_ADMIN" | "ORG_TECH" | "ORG_PARTICIPANT";

export type OrganizationMemberRole =
  | "ORG_ADMIN"
  | "ORG_TECH"
  | "ORG_PARTICIPANT";

export type OrganizationStatus = "ACTIVE" | "SUSPENDED";

export type CommitteeTitle =
  | "CHAIR"
  | "SECRETARY"
  | "MEMBER"
  | "DEPUTY"
  | "CUSTOM";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";

export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETE";

export type AssignmentSource = "SUPERVISORY" | "COMMITTEE_REFERRAL";

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

export type EntityType =
  | "ASSIGNMENT"
  | "PROJECT"
  | "TASK"
  | "REPORT"
  | "LIBRARY_DOCUMENT"
  | "DOCUMENT";

export type SupervisoryTitle = "HEAD" | "SECRETARY" | "MEMBER" | "CUSTOM";

export type ScheduleKind = "MEETING" | "EVENT";

export type ScheduleFormat = "IN_PERSON" | "VIRTUAL" | "HYBRID";

export type MessageThreadKind = "DIRECT" | "COMMITTEE" | "GROUP";

export type ApprovalStackRole =
  | "COMMITTEE_CHAIR"
  | "COMMITTEE_SECRETARY"
  | "SUPERVISORY_SECRETARY"
  | "SUPERVISORY_HEAD"
  | "SUPERVISORY_TITLE";

export type ApprovalStackStep = {
  order: number;
  role: ApprovalStackRole;
  titleKey?: string;
  label: string;
};

export type ReportStatus = "DRAFT" | "SUBMITTED" | "RETURNED" | "FINAL";

export type AttentionUrgency = "NOW" | "SOON" | "WAITING" | "FYI";

export type AttentionKind =
  | "TASK"
  | "ASSIGNMENT"
  | "REVIEW"
  | "REFERRAL"
  | "MINUTES"
  | "COMMENT"
  | "REPORT";

export type CommitteeMembership = {
  committeeId: string;
  title: CommitteeTitle;
  customTitle?: string | null;
};

export type OrganizationSettings = {
  supervisoryLabel: string;
  committeeLabel: string;
  committeeBudgetsEnabled: boolean;
  allowCrossCommitteeRead: boolean;
  requireOversightOnSelfInitiated: boolean;
  allowSupervisoryAssignMembers: boolean;
  approvalStack: ApprovalStackStep[];
};

/** @deprecated use OrganizationSettings */
export type AppSettings = OrganizationSettings;

export type SupervisoryMembership = {
  isHead: boolean;
  title: SupervisoryTitle;
  customTitle?: string | null;
  canViewAll?: boolean;
  canApproveOptional?: boolean;
};

export type PermissionUser = {
  id: string;
  role: UserRole;
  orgRole?: OrganizationMemberRole | null;
  committeeMemberships: CommitteeMembership[];
  supervisoryMembership?: SupervisoryMembership | null;
  /** @deprecated use supervisoryMembership */
  presbyteryMembership?: SupervisoryMembership | null;
  orgSettings?: Pick<
    OrganizationSettings,
    | "allowCrossCommitteeRead"
    | "requireOversightOnSelfInitiated"
    | "approvalStack"
  > | null;
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ORG_ADMIN: "Org Admin",
  ORG_TECH: "Org Tech",
  ORG_PARTICIPANT: "Member",
};

export const ORG_MEMBER_ROLE_LABELS: Record<OrganizationMemberRole, string> = {
  ORG_ADMIN: "Org Admin",
  ORG_TECH: "Org Tech",
  ORG_PARTICIPANT: "Member",
};

export const COMMITTEE_TITLE_LABELS: Record<CommitteeTitle, string> = {
  CHAIR: "Chair",
  SECRETARY: "Secretary",
  MEMBER: "Member",
  DEPUTY: "Deputy",
  CUSTOM: "Custom",
};

export const SUPERVISORY_TITLE_LABELS: Record<SupervisoryTitle, string> = {
  HEAD: "Head",
  SECRETARY: "Secretary",
  MEMBER: "Member",
  CUSTOM: "Custom",
};

export const SCHEDULE_KIND_LABELS: Record<ScheduleKind, string> = {
  MEETING: "Meeting",
  EVENT: "Event",
};

export const SCHEDULE_FORMAT_LABELS: Record<ScheduleFormat, string> = {
  IN_PERSON: "In person",
  VIRTUAL: "Virtual",
  HYBRID: "Hybrid",
};

export const DEFAULT_APPROVAL_STACK: ApprovalStackStep[] = [
  { order: 1, role: "COMMITTEE_CHAIR", label: "Chair" },
  { order: 2, role: "SUPERVISORY_SECRETARY", label: "Secretary" },
];

export const CHURCH_APPROVAL_STACK: ApprovalStackStep[] = [
  { order: 1, role: "COMMITTEE_CHAIR", label: "Chair" },
  {
    order: 2,
    role: "SUPERVISORY_SECRETARY",
    label: "General Secretary",
  },
];

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
  ACCEPTED: "Received",
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

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  RETURNED: "Returned",
  FINAL: "Final",
};

export function effectiveOrgRole(user: PermissionUser): OrganizationMemberRole {
  return user.orgRole ?? (user.role as OrganizationMemberRole);
}

export function getCommitteeTitle(
  user: PermissionUser,
  committeeId: string,
): CommitteeTitle | null {
  const membership = user.committeeMemberships.find(
    (m) => m.committeeId === committeeId,
  );
  return membership?.title ?? null;
}

export function isOrgAdmin(user: PermissionUser | UserRole): boolean {
  if (typeof user === "string") return user === "ORG_ADMIN";
  return effectiveOrgRole(user) === "ORG_ADMIN";
}

/** @deprecated use isOrgAdmin */
export function isSuperAdmin(role: UserRole): boolean {
  return role === "ORG_ADMIN";
}

export function isOrgTech(user: PermissionUser | UserRole): boolean {
  if (typeof user === "string") return user === "ORG_TECH";
  return effectiveOrgRole(user) === "ORG_TECH";
}

/** @deprecated use isOrgTech */
export function isSystemAdmin(role: UserRole): boolean {
  return role === "ORG_TECH";
}

function supervisory(user: PermissionUser) {
  return user.supervisoryMembership ?? user.presbyteryMembership ?? null;
}

export function isSupervisoryMember(user: PermissionUser): boolean {
  return supervisory(user) != null;
}

/** @deprecated use isSupervisoryMember */
export function isPresbyteryMember(user: PermissionUser): boolean {
  return isSupervisoryMember(user);
}

export function isSupervisoryHead(user: PermissionUser): boolean {
  const s = supervisory(user);
  return s?.isHead === true || s?.title === "HEAD";
}

/** @deprecated use isSupervisoryHead */
export function isPresbyteryHead(user: PermissionUser): boolean {
  return isSupervisoryHead(user);
}

export function isSupervisorySecretary(user: PermissionUser): boolean {
  return supervisory(user)?.title === "SECRETARY";
}

export function canViewAllCommittees(user: PermissionUser): boolean {
  if (isOrgAdmin(user) || isOrgTech(user)) return true;
  const s = supervisory(user);
  if (s?.canViewAll || s?.isHead || s?.title === "HEAD" || s?.title === "SECRETARY") {
    return true;
  }
  if (isSupervisoryMember(user)) return true;
  return user.orgSettings?.allowCrossCommitteeRead === true;
}

export function canOptionallyApprove(user: PermissionUser): boolean {
  if (isOrgAdmin(user)) return true;
  const s = supervisory(user);
  return Boolean(s?.canApproveOptional || s?.isHead || s?.title === "HEAD");
}

export function canManageUsers(user: PermissionUser | UserRole): boolean {
  if (typeof user === "string") {
    return user === "ORG_ADMIN" || user === "ORG_TECH";
  }
  const role = effectiveOrgRole(user);
  return role === "ORG_ADMIN" || role === "ORG_TECH";
}

export function canInviteMembers(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (canManageUsers(user)) return true;
  return getCommitteeTitle(user, committeeId) === "CHAIR";
}

export function canManageCommitteeConfig(
  user: PermissionUser | UserRole,
): boolean {
  return canManageUsers(user);
}

export function canManageSupervisoryRoster(
  user: PermissionUser | UserRole,
): boolean {
  return canManageUsers(user);
}

/** @deprecated use canManageSupervisoryRoster */
export function canManagePresbyteryRoster(role: UserRole): boolean {
  return canManageSupervisoryRoster(role);
}

/** File downloads only. ORG_TECH is always denied. */
export function canReadDocuments(
  user: PermissionUser,
  committeeId?: string,
): boolean {
  if (isOrgTech(user)) return false;
  if (isOrgAdmin(user) || isSupervisoryMember(user)) return true;
  if (!committeeId) return false;
  return getCommitteeTitle(user, committeeId) != null;
}

export function canEditTasks(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isOrgAdmin(user)) return true;
  const title = getCommitteeTitle(user, committeeId);
  return title === "CHAIR" || title === "SECRETARY" || title === "DEPUTY";
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
  if (isOrgAdmin(user)) return true;
  return getCommitteeTitle(user, committeeId) === "CHAIR";
}

export function canAcceptAssignments(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isOrgAdmin(user)) return true;
  const title = getCommitteeTitle(user, committeeId);
  return title === "CHAIR" || title === "SECRETARY";
}

export function canApproveAssignmentReview(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isOrgAdmin(user)) return true;
  if (getCommitteeTitle(user, committeeId) === "CHAIR") return true;
  return isSupervisoryHead(user);
}

export function canCreateSupervisoryAssignment(user: PermissionUser): boolean {
  return isOrgAdmin(user) || isSupervisoryMember(user);
}

/** @deprecated use canCreateSupervisoryAssignment */
export function canCreatePresbyteryAssignment(user: PermissionUser): boolean {
  return canCreateSupervisoryAssignment(user);
}

export function canCreateReferral(
  user: PermissionUser,
  sourceCommitteeId: string,
): boolean {
  if (isOrgAdmin(user)) return true;
  return getCommitteeTitle(user, sourceCommitteeId) === "CHAIR";
}

export function canCloseAssignment(
  user: PermissionUser,
  createdById: string,
): boolean {
  if (isOrgAdmin(user)) return true;
  return user.id === createdById;
}

export function canRsvp(user: PermissionUser): boolean {
  if (isSupervisoryMember(user) && !isOrgAdmin(user)) {
    return user.committeeMemberships.length > 0;
  }
  return true;
}

export function canReviewFeedback(
  user: PermissionUser,
  committeeId?: string,
): boolean {
  if (canViewAllCommittees(user)) return true;
  if (!committeeId) return false;
  return canEditTasks(user, committeeId);
}

export function canSubmitReport(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isOrgAdmin(user)) return true;
  const title = getCommitteeTitle(user, committeeId);
  return title === "CHAIR" || title === "SECRETARY" || title === "DEPUTY";
}

export function canReviewReport(user: PermissionUser): boolean {
  return isOrgAdmin(user) || isSupervisoryMember(user);
}

/** Block supervisory-only users from committee mutations unless they hold a title. */
export function isCommitteeReadOnly(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isOrgAdmin(user)) return false;
  if (!isSupervisoryMember(user)) return false;
  return getCommitteeTitle(user, committeeId) == null;
}

export function assertCommitteeMutationAllowed(
  user: PermissionUser,
  committeeId: string,
): boolean {
  return !isCommitteeReadOnly(user, committeeId);
}

/** @deprecated */
export function isReadOnlyExecutive(role: UserRole): boolean {
  return role === "ORG_PARTICIPANT";
}

export const DEFAULT_ORG_CAPABILITIES = {
  viewAllCommittees: false,
  manageUsers: false,
  manageStructure: false,
  manageRbac: false,
  createSupervisoryAssignment: false,
  approveReports: false,
  editTasks: false,
  logMinutes: false,
  approveMinutes: false,
  invite: false,
  submitReports: false,
  updateAssignedTasks: true,
} as const;

export type OrgCapabilityKey = keyof typeof DEFAULT_ORG_CAPABILITIES;
