import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canActOnApprovalStep,
  currentApprovalStep,
} from "@/lib/approval-stack";
import { getOrgSettings } from "@/lib/settings";
import {
  canEditTasks,
  canViewAllCommittees,
  canCreateDirective,
  type TaskWorkClass,
} from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const eventId = searchParams.get("eventId");
  const assignedToMe = searchParams.get("assignedToMe") === "true";
  const waitingReview = searchParams.get("waitingReview") === "true";
  const global = searchParams.get("global") === "true";
  const scope = searchParams.get("scope");
  const statusFilter = searchParams.get("status");
  const perm = asPermissionUser(auth.user);

  const taskInclude = {
    assignedTo: { select: { id: true, name: true } },
    event: { select: { id: true, title: true } },
    committee: { select: { id: true, name: true, charterLetter: true, organizationId: true } },
    subtasks: {
      include: { assignedTo: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" as const },
    },
  };

  async function filterWaitingReview<
    T extends {
      status: string;
      workClass: TaskWorkClass;
      approvalStepIndex: number;
      committeeId: string;
      committee: { organizationId: string };
    },
  >(tasks: T[]): Promise<T[]> {
    if (!waitingReview) return tasks;
    const byOrg = new Map<string, Awaited<ReturnType<typeof getOrgSettings>>>();
    const out: T[] = [];
    for (const task of tasks) {
      if (task.status !== "IN_REVIEW" || task.workClass === "PERSONAL") continue;
      let settings = byOrg.get(task.committee.organizationId);
      if (!settings) {
        settings = await getOrgSettings(task.committee.organizationId);
        byOrg.set(task.committee.organizationId, settings);
      }
      const stack =
        task.workClass === "DIRECTIVE"
          ? settings.directiveApprovalStack
          : settings.committeeApprovalStack;
      const step = currentApprovalStep(stack, task.approvalStepIndex);
      if (canActOnApprovalStep(perm, step, task.committeeId)) {
        out.push(task);
      }
    }
    return out;
  }

  if (global) {
    if (!canViewAllCommittees(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
        ...(waitingReview ? { status: "IN_REVIEW" } : {}),
        ...(statusFilter && !waitingReview
          ? { status: statusFilter as never }
          : {}),
      },
      include: taskInclude,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(await filterWaitingReview(tasks));
  }

  if (scope === "mine" || (!committeeId && scope !== "all")) {
    const committeeIds = canViewAllCommittees(perm)
      ? undefined
      : auth.user.committeeMemberships.map((m) => m.committeeId);
    const tasks = await prisma.task.findMany({
      where: {
        parentId: null,
        ...(committeeIds ? { committeeId: { in: committeeIds } } : {}),
        ...(eventId ? { eventId } : {}),
        ...(assignedToMe ? { assignedToId: auth.user.id } : {}),
        ...(waitingReview
          ? { status: "IN_REVIEW" }
          : statusFilter
            ? { status: statusFilter as never }
            : {}),
      },
      include: taskInclude,
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
    return NextResponse.json(await filterWaitingReview(tasks));
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
      ...(assignedToMe ? { assignedToId: auth.user.id } : {}),
      parentId: null,
      ...(waitingReview
        ? { status: "IN_REVIEW" }
        : statusFilter
          ? { status: statusFilter as never }
          : {}),
    },
    include: taskInclude,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(await filterWaitingReview(tasks));
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    committeeId?: string;
    eventId?: string;
    parentId?: string;
    dueDate?: string;
    assignedToId?: string;
    workClass?: "DIRECTIVE" | "COMMITTEE" | "PERSONAL";
  };

  if (!body.title || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const mutation = assertCommitteeMutation(auth.user, body.committeeId);
  if (mutation) return mutation;

  const access = assertCommitteeAccess(auth.user, body.committeeId);
  if (access) return access;

  const perm = asPermissionUser(auth.user);
  const isEditor = canEditTasks(perm, body.committeeId);
  const isSubtask = !!body.parentId;
  let workClass = body.workClass ?? "COMMITTEE";

  if (isSubtask) {
    const parent = await prisma.task.findUnique({
      where: { id: body.parentId },
      include: { parent: { select: { id: true, parentId: true, workClass: true } } },
    });
    if (!parent || parent.committeeId !== body.committeeId) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }
    // Allow 2 nesting levels: root → child → grandchild
    if (parent.parent?.parentId) {
      return NextResponse.json(
        { error: "Only two levels of nesting are supported" },
        { status: 400 },
      );
    }
    // Infer workClass from parent when not provided
    if (!body.workClass) {
      if (parent.workClass === "DIRECTIVE") workClass = "COMMITTEE";
      else if (parent.workClass === "COMMITTEE") workClass = "PERSONAL";
      else workClass = "PERSONAL";
    }
    body.eventId = body.eventId ?? parent.eventId ?? undefined;
  } else if (workClass === "DIRECTIVE") {
    if (!canViewAllCommittees(perm) && !canCreateDirective(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
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
      workClass,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      assignedToId: body.assignedToId ?? null,
      createdById: auth.user.id,
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      event: { select: { id: true, title: true } },
      committee: { select: { id: true, name: true, charterLetter: true } },
      subtasks: {
        include: { assignedTo: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(task, { status: 201 });
}
