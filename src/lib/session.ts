import type { SessionUser } from "@/lib/auth";
import {
  ACTIVE_ORG_COOKIE,
  USER_COOKIE,
} from "@/lib/auth";
import type { OrganizationMemberRole, RoleCapabilities } from "@/lib/types";
import {
  capsFromTemplates,
  committeeTitleTemplateKey,
  supervisoryTitleTemplateKey,
} from "@/lib/role-capabilities";

type MembershipSummary = {
  organizationId: string;
  organizationName: string;
  organizationStatus: "ACTIVE" | "SUSPENDED";
  orgRole: OrganizationMemberRole;
  rolesSummary: string[];
};

type UserWithRelations = {
  id: string;
  name: string;
  email: string;
  role: SessionUser["role"];
  mustChangePassword?: boolean;
  isPlatformAdmin?: boolean;
  orgContext?: SessionUser["orgContext"];
  committeeMemberships: {
    committeeId: string;
    title: SessionUser["committeeMemberships"][number]["title"];
    customTitle?: string | null;
  }[];
  roleTemplates?: { key: string; capabilities: unknown }[];
  supervisoryMemberships?: {
    isHead: boolean;
    title?: string;
    customTitle?: string | null;
    roleTemplateKey?: string | null;
    canViewAll?: boolean;
    canApproveOptional?: boolean;
  }[];
  presbyteryMembership?: {
    isHead: boolean;
    title?: string;
    customTitle?: string | null;
    roleTemplateKey?: string | null;
    canViewAll?: boolean;
    canApproveOptional?: boolean;
  } | null;
  organizationMemberships?: {
    role: OrganizationMemberRole;
    organization: { id: string; name: string; status: "ACTIVE" | "SUSPENDED" };
  }[];
};

export function buildRolesSummary(input: {
  orgRole: OrganizationMemberRole;
  supervisory?: {
    isHead: boolean;
    title?: string;
    customTitle?: string | null;
  } | null;
  committeeTitles: string[];
}): string[] {
  const roles: string[] = [];
  if (input.orgRole === "ORG_ADMIN") roles.push("Org Admin");
  if (input.orgRole === "ORG_TECH") roles.push("Org Tech");
  if (input.supervisory?.customTitle) {
    roles.push(input.supervisory.customTitle);
  } else if (input.supervisory?.isHead || input.supervisory?.title === "HEAD") {
    roles.push("Supervisory Head");
  } else if (input.supervisory?.title === "SECRETARY") {
    roles.push("Supervisory Secretary");
  } else if (input.supervisory) {
    roles.push("Supervisory Member");
  }
  for (const t of input.committeeTitles) {
    if (!roles.includes(t)) roles.push(t);
  }
  if (roles.length === 0) roles.push("Member");
  return roles;
}

export function toSessionPayload(user: UserWithRelations) {
  const supervisory =
    user.supervisoryMemberships?.[0] ?? user.presbyteryMembership ?? null;
  const templates = user.roleTemplates ?? [];
  const committeeCapabilities: Record<string, RoleCapabilities> = {};
  for (const m of user.committeeMemberships) {
    committeeCapabilities[m.committeeId] = capsFromTemplates(
      templates,
      committeeTitleTemplateKey(m.title),
    );
  }
  const supervisoryTemplateKey =
    supervisory &&
    typeof supervisory.roleTemplateKey === "string" &&
    supervisory.roleTemplateKey
      ? supervisory.roleTemplateKey
      : supervisory
        ? supervisoryTitleTemplateKey(
            (supervisory.title as "HEAD" | "SECRETARY" | "MEMBER" | "CUSTOM") ??
              "MEMBER",
            supervisory.isHead,
          )
        : "SUPERVISORY_MEMBER";
  const supervisoryCapabilities = supervisory
    ? capsFromTemplates(templates, supervisoryTemplateKey)
    : null;

  const memberships: MembershipSummary[] = (user.organizationMemberships ?? []).map(
    (m) => ({
      organizationId: m.organization.id,
      organizationName: m.organization.name,
      organizationStatus: m.organization.status,
      orgRole: m.role,
      rolesSummary: buildRolesSummary({
        orgRole: m.role,
        supervisory:
          user.orgContext?.organizationId === m.organization.id
            ? supervisory
            : null,
        committeeTitles: [],
      }),
    }),
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: Boolean(user.mustChangePassword),
    isPlatformAdmin: Boolean(user.isPlatformAdmin),
    activeOrganizationId: user.orgContext?.organizationId ?? null,
    organization: user.orgContext
      ? {
          id: user.orgContext.organizationId,
          name: user.orgContext.organizationName,
          status: user.orgContext.organizationStatus,
          orgRole: user.orgContext.orgRole,
          settings: user.orgContext.settings,
        }
      : null,
    memberships,
    committeeIds: user.committeeMemberships.map((m) => m.committeeId),
    committeeMemberships: user.committeeMemberships.map((m) => ({
      committeeId: m.committeeId,
      title: m.title,
      customTitle: m.customTitle ?? null,
    })),
    supervisoryMembership: supervisory
      ? {
          isHead: supervisory.isHead,
          title: (supervisory.title as "HEAD" | "SECRETARY" | "MEMBER" | "CUSTOM") ?? (supervisory.isHead ? "HEAD" : "MEMBER"),
          customTitle: supervisory.customTitle ?? null,
          canViewAll:
            supervisoryCapabilities?.canViewAll ?? supervisory.canViewAll,
          canApproveOptional:
            supervisoryCapabilities?.canApproveOptional ??
            supervisory.canApproveOptional,
        }
      : null,
    committeeCapabilities,
    supervisoryCapabilities,
  };
}

export function setSessionCookie(
  response: {
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
    };
  },
  userId: string,
) {
  response.cookies.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function setActiveOrgCookie(
  response: {
    cookies: {
      set: (name: string, value: string, options: Record<string, unknown>) => void;
    };
  },
  organizationId: string,
) {
  response.cookies.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function clearActiveOrgCookie(response: {
  cookies: { delete: (name: string) => void };
}) {
  response.cookies.delete(ACTIVE_ORG_COOKIE);
}
