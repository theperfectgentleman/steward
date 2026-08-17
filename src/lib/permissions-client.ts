import type {
  OrganizationMemberRole,
  PermissionUser,
  RoleCapabilities,
  SupervisoryMembership,
  SupervisoryTitle,
  UserRole,
  CommitteeTitle,
} from "@/lib/types";

function normalizeSupervisory(
  s: {
    isHead: boolean;
    title?: SupervisoryTitle | string;
    customTitle?: string | null;
    canViewAll?: boolean;
    canApproveOptional?: boolean;
  } | null | undefined,
): SupervisoryMembership | null {
  if (!s) return null;
  const title = (s.title as SupervisoryTitle | undefined) ?? (s.isHead ? "HEAD" : "MEMBER");
  return {
    isHead: s.isHead,
    title,
    customTitle: s.customTitle ?? null,
    canViewAll: s.canViewAll,
    canApproveOptional: s.canApproveOptional,
  };
}

export function toPermissionUser(user: {
  id: string;
  role: UserRole;
  organization?: {
    orgRole?: OrganizationMemberRole;
    settings?: {
      allowCrossCommitteeRead?: boolean;
      requireOversightOnSelfInitiated?: boolean;
    } | null;
  } | null;
  committeeMemberships: {
    committeeId: string;
    title: CommitteeTitle;
    customTitle?: string | null;
  }[];
  supervisoryMembership?: {
    isHead: boolean;
    title?: SupervisoryTitle | string;
    customTitle?: string | null;
    canViewAll?: boolean;
    canApproveOptional?: boolean;
  } | null;
  presbyteryMembership?: {
    isHead: boolean;
    title?: SupervisoryTitle | string;
    customTitle?: string | null;
    canViewAll?: boolean;
    canApproveOptional?: boolean;
  } | null;
  committeeCapabilities?: Record<string, RoleCapabilities>;
  supervisoryCapabilities?: RoleCapabilities | null;
}): PermissionUser {
  const supervisory = normalizeSupervisory(
    user.supervisoryMembership ?? user.presbyteryMembership,
  );
  return {
    id: user.id,
    role: user.role,
    orgRole: user.organization?.orgRole ?? null,
    committeeMemberships: user.committeeMemberships,
    supervisoryMembership: supervisory,
    committeeCapabilities: user.committeeCapabilities,
    supervisoryCapabilities: user.supervisoryCapabilities ?? null,
    orgSettings: user.organization?.settings
      ? {
          allowCrossCommitteeRead:
            user.organization.settings.allowCrossCommitteeRead === true,
          requireOversightOnSelfInitiated:
            user.organization.settings.requireOversightOnSelfInitiated === true,
          directiveApprovalStack: [],
          committeeApprovalStack: [],
        }
      : null,
  };
}

export function committeeListScope(user: {
  id: string;
  organization?: { orgRole?: OrganizationMemberRole } | null;
}): "all" | string {
  const role = user.organization?.orgRole;
  if (role === "ORG_ADMIN" || role === "ORG_PARTICIPANT") return "all";
  return user.id;
}
