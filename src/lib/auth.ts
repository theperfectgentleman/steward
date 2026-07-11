import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  canViewAllCommittees,
  type PermissionUser,
  type UserRole,
} from "@/lib/types";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

function toPermissionUser(
  user: SessionUser,
): PermissionUser {
  return {
    id: user.id,
    role: user.role,
    committeeMemberships: user.committeeMemberships.map((m) => ({
      committeeId: m.committeeId,
      title: m.title,
    })),
    presbyteryMembership: user.presbyteryMembership
      ? { isHead: user.presbyteryMembership.isHead }
      : null,
  };
}

export function asPermissionUser(user: SessionUser): PermissionUser {
  return toPermissionUser(user);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("unitycommit-user")?.value ?? null;
}

export async function getSessionUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      committeeMemberships: true,
      presbyteryMembership: true,
    },
  });
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

export async function requireRoles(
  roles: UserRole[],
): Promise<
  { user: SessionUser; error?: never } | { user?: never; error: NextResponse }
> {
  const result = await requireUser();
  if (result.error) return result;
  if (!roles.includes(result.user.role)) {
    return { error: forbidden() };
  }
  return result;
}

export function assertCommitteeMutation(
  user: SessionUser,
  committeeId: string,
): NextResponse | null {
  if (user.role !== "CHURCH_EXECUTIVE") return null;
  const hasTitle = user.committeeMemberships.some(
    (m) => m.committeeId === committeeId,
  );
  if (!hasTitle) {
    return forbidden(
      "Presbytery members have read-only access to committee work",
    );
  }
  return null;
}

/** @deprecated use assertCommitteeMutation */
export function assertNotReadOnly(user: SessionUser): NextResponse | null {
  if (user.role === "CHURCH_EXECUTIVE") {
    return forbidden("Presbytery members have read-only access");
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
