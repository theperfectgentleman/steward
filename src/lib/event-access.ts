import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  type SessionUser,
} from "@/lib/auth";
import { canEditTasks, canViewAllCommittees } from "@/lib/types";

/** Guard for Event.committeeId after it became optional. */
export function requireEventCommitteeId(committeeId: string | null) {
  if (!committeeId) {
    return NextResponse.json(
      { error: "Event is not linked to a committee" },
      { status: 400 },
    );
  }
  return null;
}

export function assertEventOrgAccess(
  user: SessionUser,
  event: { organizationId: string; committeeId: string | null },
  organizationId: string,
): NextResponse | null {
  if (event.organizationId !== organizationId) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (event.committeeId) {
    return assertCommitteeAccess(user, event.committeeId);
  }
  return null;
}

export function assertEventOrgMutation(
  user: SessionUser,
  event: { organizationId: string; committeeId: string | null },
  organizationId: string,
): NextResponse | null {
  const access = assertEventOrgAccess(user, event, organizationId);
  if (access) return access;
  if (event.committeeId) {
    const mutation = assertCommitteeMutation(user, event.committeeId);
    if (mutation) return mutation;
    const perm = asPermissionUser(user);
    if (!canEditTasks(perm, event.committeeId)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    return null;
  }
  const perm = asPermissionUser(user);
  if (!canViewAllCommittees(perm)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  return null;
}
