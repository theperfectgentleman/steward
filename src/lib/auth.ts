import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  canViewAllCommittees,
  type OrganizationMemberRole,
  type PermissionUser,
  type UserRole,
} from "@/lib/types";

export const ACTIVE_ORG_COOKIE = "steward-active-org";
export const USER_COOKIE = "unitycommit-user";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export type OrgContext = {
  organizationId: string;
  organizationName: string;
  organizationStatus: "ACTIVE" | "SUSPENDED";
  orgRole: OrganizationMemberRole;
  settings: {
    supervisoryLabel: string;
    committeeLabel: string;
    committeeBudgetsEnabled: boolean;
    allowCrossCommitteeRead: boolean;
    requireOversightOnSelfInitiated: boolean;
    allowSupervisoryAssignMembers: boolean;
    approvalStack: import("@/lib/types").ApprovalStackStep[];
  };
};

function toPermissionUser(user: SessionUser): PermissionUser {
  const supervisory = user.supervisoryMemberships[0] ?? null;
  return {
    id: user.id,
    role: user.role,
    orgRole: user.activeMembership?.role ?? (user.role as OrganizationMemberRole),
    committeeMemberships: user.committeeMemberships.map((m) => ({
      committeeId: m.committeeId,
      title: m.title,
      customTitle: m.customTitle,
    })),
    supervisoryMembership: supervisory
      ? {
          isHead: supervisory.isHead,
          title: supervisory.title,
          customTitle: supervisory.customTitle,
          canViewAll: supervisory.canViewAll,
          canApproveOptional: supervisory.canApproveOptional,
        }
      : null,
    presbyteryMembership: supervisory
      ? {
          isHead: supervisory.isHead,
          title: supervisory.title,
          customTitle: supervisory.customTitle,
          canViewAll: supervisory.canViewAll,
          canApproveOptional: supervisory.canApproveOptional,
        }
      : null,
    orgSettings: user.orgContext
      ? {
          allowCrossCommitteeRead: user.orgContext.settings.allowCrossCommitteeRead,
          requireOversightOnSelfInitiated:
            user.orgContext.settings.requireOversightOnSelfInitiated,
          approvalStack: user.orgContext.settings.approvalStack,
        }
      : null,
  };
}

export function asPermissionUser(user: SessionUser): PermissionUser {
  return toPermissionUser(user);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(USER_COOKIE)?.value ?? null;
}

export async function getActiveOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_ORG_COOKIE)?.value ?? null;
}

export async function getSessionUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const activeOrgId = await getActiveOrganizationId();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      platformAdmin: true,
      organizationMemberships: {
        include: {
          organization: {
            include: { settings: true },
          },
        },
      },
      committeeMemberships: {
        include: { committee: { select: { organizationId: true } } },
      },
      supervisoryMemberships: {
        include: { group: { select: { organizationId: true } } },
      },
    },
  });

  if (!user) return null;

  const activeMembership =
    user.organizationMemberships.find(
      (m) => m.organizationId === activeOrgId,
    ) ?? null;

  const orgContext: OrgContext | null =
    activeMembership && activeMembership.organization.settings
      ? {
          organizationId: activeMembership.organizationId,
          organizationName: activeMembership.organization.name,
          organizationStatus: activeMembership.organization.status,
          orgRole: activeMembership.role,
          settings: {
            supervisoryLabel:
              activeMembership.organization.settings.supervisoryLabel,
            committeeLabel:
              activeMembership.organization.settings.committeeLabel,
            committeeBudgetsEnabled:
              activeMembership.organization.settings.committeeBudgetsEnabled,
            allowCrossCommitteeRead:
              activeMembership.organization.settings.allowCrossCommitteeRead,
            requireOversightOnSelfInitiated:
              activeMembership.organization.settings
                .requireOversightOnSelfInitiated,
            allowSupervisoryAssignMembers:
              activeMembership.organization.settings
                .allowSupervisoryAssignMembers,
            approvalStack: Array.isArray(
              activeMembership.organization.settings.approvalStack,
            )
              ? (activeMembership.organization.settings
                  .approvalStack as import("@/lib/types").ApprovalStackStep[])
              : [],
          },
        }
      : null;

  const committeeMemberships = orgContext
    ? user.committeeMemberships.filter(
        (m) => m.committee.organizationId === orgContext.organizationId,
      )
    : [];

  const supervisoryMemberships = orgContext
    ? user.supervisoryMemberships.filter(
        (m) => m.group.organizationId === orgContext.organizationId,
      )
    : [];

  return {
    ...user,
    activeMembership,
    orgContext,
    committeeMemberships,
    supervisoryMemberships,
    /** @deprecated */
    presbyteryMembership: supervisoryMemberships[0] ?? null,
    isPlatformAdmin: Boolean(user.platformAdmin),
  };
}

export function unauthorized(message = "Sign in required") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Not authorized") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function requireUser(): Promise<
  { user: SessionUser; error?: never } | { user?: never; error: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { error: unauthorized() };
  return { user };
}

export async function requireActiveOrg(): Promise<
  | { user: SessionUser; org: OrgContext; error?: never }
  | { user?: never; org?: never; error: NextResponse }
> {
  const result = await requireUser();
  if (result.error) return result;
  if (!result.user.orgContext) {
    return {
      error: NextResponse.json(
        { error: "Select an organization first", code: "NO_ACTIVE_ORG" },
        { status: 409 },
      ),
    };
  }
  if (result.user.orgContext.organizationStatus === "SUSPENDED") {
    return { error: forbidden("This organization is suspended") };
  }
  return { user: result.user, org: result.user.orgContext };
}

export async function requirePlatformAdmin(): Promise<
  { user: SessionUser; error?: never } | { user?: never; error: NextResponse }
> {
  const result = await requireUser();
  if (result.error) return result;
  if (!result.user.isPlatformAdmin) {
    return { error: forbidden("Platform admin required") };
  }
  return result;
}

export async function requireRoles(
  roles: UserRole[],
): Promise<
  { user: SessionUser; error?: never } | { user?: never; error: NextResponse }
> {
  const result = await requireActiveOrg();
  if (result.error) return result;
  const orgRole = result.user.orgContext!.orgRole;
  if (!roles.includes(orgRole as UserRole) && !roles.includes(result.user.role)) {
    return { error: forbidden() };
  }
  return { user: result.user };
}

export function assertCommitteeMutation(
  user: SessionUser,
  committeeId: string,
): NextResponse | null {
  const perm = toPermissionUser(user);
  if (perm.supervisoryMembership && !isOrgAdminLike(user)) {
    const hasTitle = user.committeeMemberships.some(
      (m) => m.committeeId === committeeId,
    );
    if (!hasTitle) {
      return forbidden(
        "Supervisory members have read-only access to committee work",
      );
    }
  }
  return null;
}

function isOrgAdminLike(user: SessionUser) {
  return (
    user.orgContext?.orgRole === "ORG_ADMIN" || user.role === "ORG_ADMIN"
  );
}

/** @deprecated use assertCommitteeMutation */
export function assertNotReadOnly(user: SessionUser): NextResponse | null {
  if (user.supervisoryMemberships.length > 0 && !isOrgAdminLike(user)) {
    return forbidden("Supervisory members have read-only access");
  }
  return null;
}

export function canAccessCommittee(
  user: SessionUser,
  committeeId: string,
): boolean {
  const perm = toPermissionUser(user);
  if (canViewAllCommittees(perm)) return true;
  return user.committeeMemberships.some((m) => m.committeeId === committeeId);
}

export function assertCommitteeAccess(
  user: SessionUser,
  committeeId: string,
): NextResponse | null {
  if (!canAccessCommittee(user, committeeId)) {
    return forbidden("You do not have access to this committee");
  }
  return null;
}

export function assertOrgAdmin(user: SessionUser): NextResponse | null {
  if (user.orgContext?.orgRole === "ORG_ADMIN" || user.role === "ORG_ADMIN") {
    return null;
  }
  if (user.orgContext?.orgRole === "ORG_TECH" || user.role === "ORG_TECH") {
    return null;
  }
  return forbidden("Org admin required");
}
