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
  const global = searchParams.get("global") === "true";

  if (global) {
    if (!canViewAllCommittees(auth.user.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const tasks = await prisma.task.findMany({
      include: {
        committee: { select: { name: true, charterLetter: true } },
        assignedTo: { select: { name: true } },
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
    where: { committeeId },
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const readOnly = assertNotReadOnly(auth.user);
  if (readOnly) return readOnly;

  if (!canEditTasks(auth.user.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    committeeId?: string;
    dueDate?: string;
  };

  if (!body.title || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const access = assertCommitteeAccess(auth.user, body.committeeId);
  if (access) return access;

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      committeeId: body.committeeId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      createdById: auth.user.id,
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  return NextResponse.json(task, { status: 201 });
}
