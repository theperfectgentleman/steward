import { NextResponse } from "next/server";
import { assertCommitteeAccess, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { asPermissionUser } from "@/lib/auth";
import { canViewAllCommittees } from "@/lib/types";

function canViewAssignment(
  user: NonNullable<Awaited<ReturnType<typeof requireUser>>["user"]>,
  assignment: {
    targetCommitteeId: string | null;
    assigneeUserId: string | null;
    accountableOwnerId: string | null;
    createdById: string;
  },
): ReturnType<typeof assertCommitteeAccess> | null {
  if (assignment.createdById === user.id) return null;
  if (assignment.assigneeUserId === user.id) return null;
  if (assignment.accountableOwnerId === user.id) return null;
  if (canViewAllCommittees(asPermissionUser(user))) return null;
  if (assignment.targetCommitteeId) {
    return assertCommitteeAccess(user, assignment.targetCommitteeId);
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      targetCommittee: { select: { id: true, name: true, charterLetter: true } },
      sourceCommittee: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      accountableOwner: { select: { id: true, name: true } },
      parentAssignment: { select: { id: true, title: true } },
      childAssignments: {
        select: { id: true, title: true, status: true },
      },
      projects: {
        include: {
          tasks: {
            include: { assignedTo: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      rootTask: {
        include: {
          assignedTo: { select: { id: true, name: true } },
          subtasks: true,
        },
      },
    },
  });

  if (!assignment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = canViewAssignment(auth.user, assignment);
  if (access) return access;

  const activity = await prisma.activityLog.findMany({
    where: { entityType: "ASSIGNMENT", entityId: id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const comments = await prisma.comment.findMany({
    where: { entityType: "ASSIGNMENT", entityId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ assignment, activity, comments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json()) as { body?: string };

  if (!body.body?.trim()) {
    return NextResponse.json({ error: "Comment required" }, { status: 400 });
  }

  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = canViewAssignment(auth.user, assignment);
  if (access) return access;

  const comment = await prisma.comment.create({
    data: {
      body: body.body.trim(),
      authorId: auth.user.id,
      entityType: "ASSIGNMENT",
      entityId: id,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  await logActivity({
    entityType: "ASSIGNMENT",
    entityId: id,
    action: "COMMENT_ADDED",
    actorId: auth.user.id,
  });

  return NextResponse.json(comment, { status: 201 });
}
