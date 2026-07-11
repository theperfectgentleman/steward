import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertNotReadOnly,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTasks, canViewAllCommittees } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const eventId = searchParams.get("eventId");
  const global = searchParams.get("global") === "true";

  if (global) {
    if (!canViewAllCommittees(auth.user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const tasks = await prisma.task.findMany({
      include: {
        committee: { select: { name: true, charterLetter: true } },
        assignedTo: { select: { name: true } },
        event: { select: { id: true, title: true } },
        subtasks: {
          include: { assignedTo: { select: { id: true, name: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(tasks);
  }

  if (!committeeId) {
    return NextResponse.json({ error: "committeeId required" }, { status: 400 });
  }

  const access = assertCommitteeAccess(auth.user, committeeId);
  if (access) return access;

  const tasks = await prisma.task.findMany({
    where: {
      committeeId,
      ...(eventId ? { eventId } : {}),
      parentId: null,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      event: { select: { id: true, title: true } },
      subtasks: {
        include: { assignedTo: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const readOnly = assertNotReadOnly(auth.user);
  if (readOnly) return readOnly;

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    committeeId?: string;
    eventId?: string;
    parentId?: string;
    dueDate?: string;
    assignedToId?: string;
  };

  if (!body.title || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const access = assertCommitteeAccess(auth.user, body.committeeId);
  if (access) return access;

  const isEditor = canEditTasks(auth.user.role);
  const isSubtask = !!body.parentId;

  if (isSubtask) {
    const parent = await prisma.task.findUnique({
      where: { id: body.parentId },
    });
    if (!parent || parent.committeeId !== body.committeeId) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }
    if (parent.parentId) {
      return NextResponse.json(
        { error: "Only one level of subtasks is supported" },
        { status: 400 },
      );
    }
    body.eventId = body.eventId ?? parent.eventId ?? undefined;
  } else if (!isEditor) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (body.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: body.eventId, committeeId: body.committeeId },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
  }

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      committeeId: body.committeeId,
      eventId: body.eventId ?? null,
      parentId: body.parentId ?? null,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      assignedToId: body.assignedToId ?? null,
      createdById: auth.user.id,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      event: { select: { id: true, title: true } },
      subtasks: {
        include: { assignedTo: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
