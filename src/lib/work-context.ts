import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  type SessionUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  COMMITTEE_TITLE_LABELS,
  SUPERVISORY_TITLE_LABELS,
  canViewAllCommittees,
  type CommitteeTitle,
  type PermissionUser,
  type SupervisoryTitle,
  type TaskWorkClass,
} from "@/lib/types";

/**
 * Multi-hat card label: `{Group} · {My role there}`
 * Falls back to group name only when the viewer has no role in that group.
 */
export function formatGroupRoleLabel(
  user: PermissionUser | null | undefined,
  committee: { id: string; name: string } | null | undefined,
  opts?: { supervisoryLabel?: string },
): string {
  if (!committee) return "";
  if (!user) return committee.name;

  const membership = user.committeeMemberships.find(
    (m) => m.committeeId === committee.id,
  );
  if (membership) {
    const role =
      membership.customTitle ||
      COMMITTEE_TITLE_LABELS[membership.title as CommitteeTitle] ||
      membership.title;
    return `${committee.name} · ${role}`;
  }

  if (user.supervisoryMembership) {
    const sm = user.supervisoryMembership;
    const role =
      sm.customTitle ||
      SUPERVISORY_TITLE_LABELS[(sm.title as SupervisoryTitle) ?? "MEMBER"] ||
      opts?.supervisoryLabel ||
      "Member";
    return `${committee.name} · ${role}`;
  }

  return committee.name;
}

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
  task: { organizationId: string; committeeId: string | null },
  organizationId: string,
): NextResponse | null {
  if (task.organizationId !== organizationId) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.committeeId) {
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
