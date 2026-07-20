import type {
  OrganizationMemberRole,
  PermissionUser,
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
  organization?: { orgRole?: OrganizationMemberRole } | null;
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
    presbyteryMembership: supervisory,
  };
}
