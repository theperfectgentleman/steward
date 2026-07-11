import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertNotReadOnly,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTasks, type TaskStatus } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const readOnly = assertNotReadOnly(auth.user);
  if (readOnly) return readOnly;

  const { id } = await params;
  const body = (await request.json()) as {
    status?: TaskStatus;
    assignedToId?: string | null;
  };

  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const access = assertCommitteeAccess(auth.user, existing.committeeId);
  if (access) return access;

  const isEditor = canEditTasks(auth.user.role);
  const isAssignee =
    auth.user.role === "COMMITTEE_MEMBER" &&
    existing.assignedToId === auth.user.id;
  const isSubtaskCreator =
    auth.user.role === "COMMITTEE_MEMBER" &&
    existing.parentId !== null &&
    existing.createdById === auth.user.id;

  if (body.assignedToId !== undefined) {
    if (!isEditor) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  if (body.status !== undefined) {
    if (!isEditor && !isAssignee && !isSubtaskCreator) {
      return NextResponse.json(
        { error: "Members may only update tasks assigned to them" },
        { status: 403 },
      );
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.assignedToId !== undefined && { assignedToId: body.assignedToId }),
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  return NextResponse.json(task);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const readOnly = assertNotReadOnly(auth.user);
  if (readOnly) return readOnly;

  if (!canEditTasks(auth.user.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const access = assertCommitteeAccess(auth.user, existing.committeeId);
  if (access) return access;

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
