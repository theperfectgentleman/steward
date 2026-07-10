import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  canViewAllCommittees,
  isReadOnlyExecutive,
  type UserRole,
} from "@/lib/types";

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("unitycommit-user")?.value ?? null;
}

export async function getSessionUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    include: { committeeMemberships: true },
  });
}

export function unauthorized(message = "Sign in required") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Not authorized") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** Require a signed-in user. Returns the user or an error Response. */
export async function requireUser(): Promise<
  { user: SessionUser; error?: never } | { user?: never; error: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) return { error: unauthorized() };
  return { user };
}

/** Require one of the given roles. */
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

/** Block Church Executive from mutating data (PRD: read-only). */
export function assertNotReadOnly(user: SessionUser): NextResponse | null {
  if (isReadOnlyExecutive(user.role)) {
    return forbidden("Church executives have read-only access");
  }
  return null;
}

/** Whether the user may access a specific committee's data. */
export function canAccessCommittee(
  user: SessionUser,
  committeeId: string,
): boolean {
  if (canViewAllCommittees(user.role)) return true;
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
