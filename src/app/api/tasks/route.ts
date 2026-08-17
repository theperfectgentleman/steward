import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireActiveOrg,
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
import {
  assertCommitteeMatchesOrg,
  assertTaskRefsInOrg,
  requireCommitteeForWorkClass,
} from "@/lib/work-context.server";

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const orgId = auth.org.organizationId;
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
      committeeId: string | null;
      organizationId: string;
    },
  >(tasks: T[]): Promise<T[]> {
    if (!waitingReview) return tasks;
    const settings = await getOrgSettings(orgId);
    const out: T[] = [];
    for (const task of tasks) {
      if (task.status !== "IN_REVIEW" || task.workClass === "PERSONAL") continue;
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

  const orgWhere = { organizationId: orgId };

  if (global) {
    if (!canViewAllCommittees(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const tasks = await prisma.task.findMany({
      where: {
        ...orgWhere,
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
        ...orgWhere,
        parentId: null,
        ...(committeeIds
          ? {
              OR: [
                { committeeId: { in: committeeIds } },
                {
                  committeeId: null,
                  workClass: "PERSONAL",
                  OR: [
                    { assignedToId: auth.user.id },
                    { createdById: auth.user.id },
                  ],
                },
              ],
            }
          : {}),
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
      ...orgWhere,
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
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const orgId = auth.org.organizationId;
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    committeeId?: string | null;
    eventId?: string;
    parentId?: string;
    dependsOnTaskId?: string;
    dueDate?: string;
    assignedToId?: string;
    workClass?: "DIRECTIVE" | "COMMITTEE" | "PERSONAL";
  };

  if (!body.title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const committeeId = body.committeeId || null;
  const perm = asPermissionUser(auth.user);
  const isSubtask = !!body.parentId;
  let workClass = body.workClass ?? "COMMITTEE";

  const classErr = requireCommitteeForWorkClass(workClass, committeeId);
  if (classErr) return classErr;

  const matchErr = await assertCommitteeMatchesOrg(committeeId, orgId);
  if (matchErr) return matchErr;

  if (committeeId) {
    const mutation = assertCommitteeMutation(auth.user, committeeId);
    if (mutation) return mutation;
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  }

  const isEditor = committeeId ? canEditTasks(perm, committeeId) : canViewAllCommittees(perm);

  if (isSubtask) {
    const parent = await prisma.task.findFirst({
      where: { id: body.parentId, organizationId: orgId },
      include: { parent: { select: { id: true, parentId: true, workClass: true } } },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }
    if (committeeId && parent.committeeId && parent.committeeId !== committeeId) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 });
    }
    if (parent.parent?.parentId) {
      return NextResponse.json(
        { error: "Only two levels of nesting are supported" },
        { status: 400 },
      );
    }
    if (!body.workClass) {
      if (parent.workClass === "DIRECTIVE") workClass = "COMMITTEE";
      else if (parent.workClass === "COMMITTEE") workClass = "PERSONAL";
      else workClass = "PERSONAL";
    }
    const inferredErr = requireCommitteeForWorkClass(workClass, committeeId);
    if (inferredErr) return inferredErr;
    body.eventId = body.eventId ?? parent.eventId ?? undefined;
  } else if (workClass === "DIRECTIVE") {
    if (!canViewAllCommittees(perm) && !canCreateDirective(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (workClass !== "PERSONAL" && !isEditor) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  } else if (workClass === "PERSONAL" && !committeeId && !isEditor && !canViewAllCommittees(perm)) {
    // org-wide personal: any org member may create their own step
  }

  const refsErr = await assertTaskRefsInOrg({
    organizationId: orgId,
    assignedToId: body.assignedToId,
    parentId: body.parentId,
    dependsOnTaskId: body.dependsOnTaskId,
  });
  if (refsErr) return refsErr;

  if (body.eventId) {
    const event = await prisma.event.findFirst({
      where: {
        id: body.eventId,
        organizationId: orgId,
        ...(committeeId ? { committeeId } : {}),
      },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
  }

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      organizationId: orgId,
      committeeId,
      eventId: body.eventId ?? null,
      parentId: body.parentId ?? null,
      dependsOnTaskId: body.dependsOnTaskId ?? null,
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
