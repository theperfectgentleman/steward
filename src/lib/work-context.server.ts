import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  type SessionUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canCreateDirective,
  canViewAllCommittees,
  type TaskWorkClass,
} from "@/lib/types";

export function requireCommitteeForWorkClass(
  workClass: TaskWorkClass,
  committeeId: string | null | undefined,
): NextResponse | null {
  if ((workClass === "COMMITTEE" || workClass === "DIRECTIVE") && !committeeId) {
    return NextResponse.json(
      { error: "committeeId is required for COMMITTEE and DIRECTIVE tasks" },
      { status: 400 },
    );
  }
  return null;
}

export async function assertCommitteeMatchesOrg(
  committeeId: string | null | undefined,
  organizationId: string,
): Promise<NextResponse | null> {
  if (!committeeId) return null;
  const committee = await prisma.committee.findFirst({
    where: { id: committeeId, organizationId },
    select: { id: true },
  });
  if (!committee) {
    return NextResponse.json(
      { error: "committee.organizationId must match organizationId" },
      { status: 400 },
    );
  }
  return null;
}

export async function assertAssigneeInOrg(
  assignedToId: string | null | undefined,
  organizationId: string,
): Promise<NextResponse | null> {
  if (!assignedToId) return null;
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: assignedToId, organizationId },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json(
      { error: "assignedToId is not a member of this organization" },
      { status: 400 },
    );
  }
  return null;
}

export async function assertRelatedTaskInOrg(
  taskId: string | null | undefined,
  organizationId: string,
  field: "parentId" | "dependsOnTaskId",
): Promise<NextResponse | null> {
  if (!taskId) return null;
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId },
    select: { id: true },
  });
  if (!task) {
    return NextResponse.json(
      { error: `${field} is not in this organization` },
      { status: 400 },
    );
  }
  return null;
}

export async function assertTaskRefsInOrg(opts: {
  organizationId: string;
  assignedToId?: string | null;
  parentId?: string | null;
  dependsOnTaskId?: string | null;
}): Promise<NextResponse | null> {
  return (
    (await assertAssigneeInOrg(opts.assignedToId, opts.organizationId)) ??
    (await assertRelatedTaskInOrg(opts.parentId, opts.organizationId, "parentId")) ??
    (await assertRelatedTaskInOrg(
      opts.dependsOnTaskId,
      opts.organizationId,
      "dependsOnTaskId",
    ))
  );
}

export function assertTaskOrgAccess(
  user: SessionUser,
  task: {
    organizationId: string;
    committeeId: string | null;
    assignedToId?: string | null;
    createdById?: string | null;
  },
  organizationId: string,
): NextResponse | null {
  if (task.organizationId !== organizationId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.committeeId) {
    return assertCommitteeAccess(user, task.committeeId);
  }
  const perm = asPermissionUser(user);
  if (canViewAllCommittees(perm)) return null;
  if (task.assignedToId === user.id || task.createdById === user.id) return null;
  return NextResponse.json({ error: "Not authorized" }, { status: 403 });
}

export function assertTaskOrgMutation(
  user: SessionUser,
  task: {
    organizationId: string;
    committeeId: string | null;
    workClass?: string | null;
  },
  organizationId: string,
): NextResponse | null {
  if (task.organizationId !== organizationId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.committeeId) {
    const perm = asPermissionUser(user);
    if (task.workClass === "DIRECTIVE" && canCreateDirective(perm)) {
      return null;
    }
    return assertCommitteeMutation(user, task.committeeId);
  }
  return null;
}

/** Restrict committee delete while open COMMITTEE/DIRECTIVE children exist. */
export async function assertCommitteeDeletable(
  committeeId: string,
): Promise<NextResponse | null> {
  const open = await prisma.task.count({
    where: {
      committeeId,
      workClass: { in: ["COMMITTEE", "DIRECTIVE"] },
      status: { not: "DONE" },
    },
  });
  if (open > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete committee while open COMMITTEE or DIRECTIVE tasks exist",
      },
      { status: 409 },
    );
  }
  return null;
}
