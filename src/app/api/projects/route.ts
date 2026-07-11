import { NextResponse } from "next/server";
import {
  asPermissionUser,
  assertCommitteeAccess,
  assertCommitteeMutation,
  requireUser,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { canEditTasks, type ProjectStatus } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");

  if (!committeeId) {
    return NextResponse.json({ error: "committeeId required" }, { status: 400 });
  }

  const access = assertCommitteeAccess(auth.user, committeeId);
  if (access) return access;

  const projects = await prisma.project.findMany({
    where: { committeeId },
    include: {
      createdBy: { select: { id: true, name: true } },
      assignment: { select: { id: true, title: true, status: true } },
      tasks: {
        select: { id: true, status: true, dueDate: true },
      },
      _count: { select: { tasks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const enriched = projects.map((p) => {
    const done = p.tasks.filter((t) => t.status === "DONE").length;
    const total = p.tasks.length;
    const overdue = p.tasks.some(
      (t) =>
        t.dueDate &&
        t.dueDate.getTime() < Date.now() &&
        t.status !== "DONE",
    );
    return {
      ...p,
      progress: total ? Math.round((done / total) * 100) : 0,
      openTasks: p.tasks.filter((t) => t.status !== "DONE").length,
      overdue,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    committeeId?: string;
    assignmentId?: string;
    status?: ProjectStatus;
  };

  if (!body.title || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const mutation = assertCommitteeMutation(auth.user, body.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, body.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const project = await prisma.project.create({
    data: {
      title: body.title,
      description: body.description,
      committeeId: body.committeeId,
      assignmentId: body.assignmentId,
      status: body.status ?? "ACTIVE",
      createdById: auth.user.id,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      tasks: true,
    },
  });

  await logActivity({
    entityType: "PROJECT",
    entityId: project.id,
    action: "CREATED",
    actorId: auth.user.id,
  });

  return NextResponse.json(project, { status: 201 });
}
