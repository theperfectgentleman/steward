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

export type TaskStatus = "TODO" | "IN_PROGRESS" | "BLOCKED" | "IN_REVIEW" | "DONE";

export type TaskWorkClass = "DIRECTIVE" | "COMMITTEE" | "PERSONAL";

export type EntityType =
  | "TASK"
  | "LIBRARY_DOCUMENT"
  | "DOCUMENT"
  | "EVENT"
  | "INVITE"
  | "STRUCTURE";

export type SupervisoryTitle = "HEAD" | "SECRETARY" | "MEMBER" | "CUSTOM";

export type ScheduleKind =
  | "MEETING"
  | "WORKING_VISIT"
  | "WORKSHOP"
  | "PROGRAM"
  | "OTHER";

/** @deprecated alias — prefer ScheduleKind / EVENT_KIND_LABELS */
export type EventKind = ScheduleKind;

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

export type AttentionUrgency = "NOW" | "SOON" | "WAITING" | "FYI";

export type AttentionKind =
  | "TASK"
  | "REVIEW"
  | "MINUTES"
  | "COMMENT";

export type CommitteeMembership = {
  committeeId: string;
  title: CommitteeTitle;
  customTitle?: string | null;
};

export type RoleCapabilities = {
  editTasks: boolean;
  logMinutes: boolean;
  approveMinutes: boolean;
  invite: boolean;
  updateAssignedTasks: boolean;
  canViewAll: boolean;
  canCreateDirective: boolean;
  canApproveOptional: boolean;
};

export type OrganizationSettings = {
  supervisoryLabel: string;
  committeeLabel: string;
  committeeBudgetsEnabled: boolean;
  allowCrossCommitteeRead: boolean;
  requireOversightOnSelfInitiated: boolean;
  allowSupervisoryAssignMembers: boolean;
  directiveApprovalStack: ApprovalStackStep[];
  committeeApprovalStack: ApprovalStackStep[];
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
  committeeCapabilities?: Record<string, RoleCapabilities>;
  supervisoryCapabilities?: RoleCapabilities | null;
  orgSettings?: Pick<
    OrganizationSettings,
    | "allowCrossCommitteeRead"
    | "requireOversightOnSelfInitiated"
    | "directiveApprovalStack"
    | "committeeApprovalStack"
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
  WORKING_VISIT: "Working visit",
  WORKSHOP: "Workshop",
  PROGRAM: "Program",
  OTHER: "Other",
};

/** Prefer this alias in new UI code. */
export const EVENT_KIND_LABELS = SCHEDULE_KIND_LABELS;

export const SCHEDULE_FORMAT_LABELS: Record<ScheduleFormat, string> = {
  IN_PERSON: "In person",
  VIRTUAL: "Virtual",
  HYBRID: "Hybrid",
};

export const DEFAULT_COMMITTEE_APPROVAL_STACK: ApprovalStackStep[] = [
  { order: 1, role: "COMMITTEE_SECRETARY", label: "Committee Secretary" },
  { order: 2, role: "COMMITTEE_CHAIR", label: "Committee Chair" },
];

export const DEFAULT_DIRECTIVE_APPROVAL_STACK: ApprovalStackStep[] = [
  { order: 1, role: "COMMITTEE_SECRETARY", label: "Committee Secretary" },
  { order: 2, role: "COMMITTEE_CHAIR", label: "Committee Chair" },
  { order: 3, role: "SUPERVISORY_SECRETARY", label: "Governance Secretary" },
  { order: 4, role: "SUPERVISORY_HEAD", label: "Governance Head" },
];

/** @deprecated use DEFAULT_COMMITTEE_APPROVAL_STACK */
export const DEFAULT_APPROVAL_STACK = DEFAULT_COMMITTEE_APPROVAL_STACK;

export const CHURCH_COMMITTEE_APPROVAL_STACK: ApprovalStackStep[] = [
  { order: 1, role: "COMMITTEE_SECRETARY", label: "Secretary" },
  { order: 2, role: "COMMITTEE_CHAIR", label: "Chair" },
];

export const CHURCH_DIRECTIVE_APPROVAL_STACK: ApprovalStackStep[] = [
  { order: 1, role: "COMMITTEE_SECRETARY", label: "Secretary" },
  { order: 2, role: "COMMITTEE_CHAIR", label: "Chair" },
  { order: 3, role: "SUPERVISORY_SECRETARY", label: "General Secretary" },
  { order: 4, role: "SUPERVISORY_HEAD", label: "General Overseer" },
];

/** @deprecated use CHURCH_COMMITTEE_APPROVAL_STACK */
export const CHURCH_APPROVAL_STACK = CHURCH_COMMITTEE_APPROVAL_STACK;

export const TASK_WORK_CLASS_LABELS: Record<TaskWorkClass, string> = {
  DIRECTIVE: "Directive",
  COMMITTEE: "Work",
  PERSONAL: "Personal",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  BLOCKED: "Awaiting",
  IN_REVIEW: "In Review",
  DONE: "Done",
};

export const TASK_STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
];

export function effectiveOrgRole(user: PermissionUser): OrganizationMemberRole {
  return user.orgRole ?? "ORG_PARTICIPANT";
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

export function isSupervisoryHead(user: PermissionUser): boolean {
  const s = supervisory(user);
  return s?.isHead === true || s?.title === "HEAD";
}

/** GO / GS (or the org's Head and Secretary titles). They see every group. */
export function isGovernanceLead(user: PermissionUser): boolean {
  const s = supervisory(user);
  if (!s) return false;
  return s.isHead === true || s.title === "HEAD" || s.title === "SECRETARY";
}

export function isSupervisorySecretary(user: PermissionUser): boolean {
  return supervisory(user)?.title === "SECRETARY";
}

export function canViewAllCommittees(user: PermissionUser): boolean {
  if (isOrgAdmin(user) || isOrgTech(user)) return true;
  if (isGovernanceLead(user)) return true;
  if (user.supervisoryCapabilities?.canViewAll) return true;
  const s = supervisory(user);
  if (s?.canViewAll) return true;
  return user.orgSettings?.allowCrossCommitteeRead === true;
}

export function canOptionallyApprove(user: PermissionUser): boolean {
  if (isOrgAdmin(user)) return true;
  if (isGovernanceLead(user)) return true;
  if (user.supervisoryCapabilities?.canApproveOptional) return true;
  const s = supervisory(user);
  return Boolean(s?.canApproveOptional);
}

export function canManageUsers(user: PermissionUser | UserRole): boolean {
  if (typeof user === "string") {
    return user === "ORG_ADMIN" || user === "ORG_TECH";
  }
  const role = effectiveOrgRole(user);
  return role === "ORG_ADMIN" || role === "ORG_TECH";
}

export function canInviteMembers(user: PermissionUser): boolean {
  return isOrgAdmin(user);
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

function committeeCaps(
  user: PermissionUser,
  committeeId: string,
): RoleCapabilities | undefined {
  return user.committeeCapabilities?.[committeeId];
}

export function canEditTasks(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isOrgAdmin(user)) return true;
  const caps = committeeCaps(user, committeeId);
  if (caps) return caps.editTasks;
  const title = getCommitteeTitle(user, committeeId);
  return title === "CHAIR" || title === "SECRETARY" || title === "DEPUTY";
}

export function canLogMinutes(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isOrgAdmin(user)) return true;
  const caps = committeeCaps(user, committeeId);
  if (caps) return caps.logMinutes;
  return canEditTasks(user, committeeId);
}

export function canApproveMinutes(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isOrgAdmin(user)) return true;
  const caps = committeeCaps(user, committeeId);
  if (caps) return caps.approveMinutes;
  return getCommitteeTitle(user, committeeId) === "CHAIR";
}

/** Create / replace a committee Terms of Reference — Chair (and Org Admin). Others may view. */
export function canManageTor(
  user: PermissionUser,
  committeeId: string,
): boolean {
  if (isOrgAdmin(user)) return true;
  return getCommitteeTitle(user, committeeId) === "CHAIR";
}

/** Create directive (supervisory-issued) tasks */
export function canCreateDirective(user: PermissionUser): boolean {
  if (isOrgAdmin(user)) return true;
  if (isGovernanceLead(user)) return true;
  if (user.supervisoryCapabilities?.canCreateDirective) return true;
  return false;
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
  createDirective: false,
  editTasks: false,
  logMinutes: false,
  approveMinutes: false,
  invite: false,
  updateAssignedTasks: true,
  canViewAll: false,
  canCreateDirective: false,
  canApproveOptional: false,
} as const;

export type OrgCapabilityKey = keyof typeof DEFAULT_ORG_CAPABILITIES;
