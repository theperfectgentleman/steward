import { NextResponse } from "next/server";
import { assertCommitteeAccess, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { asPermissionUser } from "@/lib/auth";
import { canEditTasks } from "@/lib/types";

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
      parentAssignment: { select: { id: true, title: true } },
      childAssignments: {
        select: { id: true, title: true, status: true },
      },
      project: {
        include: {
          tasks: {
            include: { assignedTo: { select: { id: true, name: true } } },
          },
        },
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

  const access = assertCommitteeAccess(auth.user, assignment.targetCommitteeId);
  if (access && assignment.createdById !== auth.user.id) {
    return access;
  }

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

  const access = assertCommitteeAccess(auth.user, assignment.targetCommitteeId);
  if (access && assignment.createdById !== auth.user.id) {
    return access;
  }

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
