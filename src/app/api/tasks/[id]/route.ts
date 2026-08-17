import { NextResponse } from "next/server";
import {
  asPermissionUser,
  requireActiveOrg,
} from "@/lib/auth";
import {
  assertAssigneeInOrg,
  assertTaskOrgAccess,
  assertTaskOrgMutation,
  requireCommitteeForWorkClass,
} from "@/lib/work-context.server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import {
  canActOnApprovalStep,
  currentApprovalStep,
  isApprovalStackComplete,
} from "@/lib/approval-stack";
import { getOrgSettings } from "@/lib/settings";
import {
  canEditTasks,
  canCreateDirective,
  getCommitteeTitle,
  type TaskStatus,
  type TaskWorkClass,
} from "@/lib/types";

type ReviewAction =
  | "submit_review"
  | "approve_step"
  | "return"
  | "close";

const taskDetailInclude = {
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  event: { select: { id: true, title: true } },
  committee: {
    select: { id: true, name: true, charterLetter: true, organizationId: true },
  },
  parent: { select: { id: true, title: true } },
  subtasks: {
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

async function stackForWorkClass(
  organizationId: string,
  workClass: TaskWorkClass,
) {
  if (workClass === "PERSONAL") return [];
  const settings = await getOrgSettings(organizationId);
  return workClass === "DIRECTIVE"
    ? settings.directiveApprovalStack
    : settings.committeeApprovalStack;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const orgId = auth.org.organizationId;
  const task = await prisma.task.findFirst({
    where: { id, organizationId: orgId },
    include: taskDetailInclude,
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const access = assertTaskOrgAccess(auth.user, task, orgId);
  if (access) return access;

  return NextResponse.json(task);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const orgId = auth.org.organizationId;
  const body = (await request.json()) as {
    status?: TaskStatus;
    assignedToId?: string | null;
    title?: string;
    description?: string | null;
    dueDate?: string | null;
    workClass?: TaskWorkClass;
    action?: ReviewAction;
    comment?: string;
  };

  const existing = await prisma.task.findFirst({
    where: { id, organizationId: orgId },
    include: {
      committee: { select: { organizationId: true } },
      subtasks: {
        select: { id: true, status: true, workClass: true },
      },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const mutation = assertTaskOrgMutation(auth.user, existing, orgId);
  if (mutation) return mutation;

  const access = assertTaskOrgAccess(auth.user, existing, orgId);
  if (access) return access;

  const perm = asPermissionUser(auth.user);
  const isEditor = existing.committeeId
    ? canEditTasks(perm, existing.committeeId)
    : canCreateDirective(perm);
  const isAssignee =
    existing.assignedToId === auth.user.id &&
    (existing.committeeId
      ? getCommitteeTitle(perm, existing.committeeId) === "MEMBER"
      : true);
  const isSubtaskCreator =
    existing.parentId !== null &&
    existing.createdById === auth.user.id &&
    (existing.committeeId
      ? getCommitteeTitle(perm, existing.committeeId) === "MEMBER"
      : true);

  // Review workflow actions
  if (body.action) {
    const workClass = existing.workClass as TaskWorkClass;
    const stack = await stackForWorkClass(existing.organizationId, workClass);

    if (body.action === "submit_review") {
      if (workClass === "PERSONAL") {
        return NextResponse.json(
          { error: "Personal steps complete only — no review ladder" },
          { status: 400 },
        );
      }
      if (!isEditor && !isAssignee && existing.createdById !== auth.user.id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      // Personal children optional; work under a directive must be accepted
      if (workClass === "DIRECTIVE") {
        const committeeChildren = existing.subtasks.filter(
          (s) => s.workClass === "COMMITTEE",
        );
        const incomplete = committeeChildren.filter((s) => s.status !== "DONE");
        if (incomplete.length > 0) {
          return NextResponse.json(
            {
              error:
                "All work under this directive must be accepted before sending it for review",
            },
            { status: 400 },
          );
        }
      }
      const task = await prisma.task.update({
        where: { id },
        data: {
          status: "IN_REVIEW",
          approvalStepIndex: 0,
          returnComment: null,
        },
        include: taskDetailInclude,
      });
      return NextResponse.json(task);
    }

    if (body.action === "approve_step") {
      if (existing.status !== "IN_REVIEW") {
        return NextResponse.json(
          { error: "Task is not in review" },
          { status: 400 },
        );
      }
      const step = currentApprovalStep(stack, existing.approvalStepIndex);
      if (!canActOnApprovalStep(perm, step, existing.committeeId)) {
        return NextResponse.json(
          { error: "Not authorized for this approval step" },
          { status: 403 },
        );
      }
      const nextIndex = existing.approvalStepIndex + 1;
      if (isApprovalStackComplete(stack, nextIndex)) {
        const task = await prisma.task.update({
          where: { id },
          data: { status: "DONE", approvalStepIndex: nextIndex },
          include: taskDetailInclude,
        });
        return NextResponse.json(task);
      }
      const task = await prisma.task.update({
        where: { id },
        data: { approvalStepIndex: nextIndex },
        include: taskDetailInclude,
      });
      return NextResponse.json(task);
    }

    if (body.action === "return") {
      if (existing.status !== "IN_REVIEW") {
        return NextResponse.json(
          { error: "Task is not in review" },
          { status: 400 },
        );
      }
      const step = currentApprovalStep(stack, existing.approvalStepIndex);
      if (!canActOnApprovalStep(perm, step, existing.committeeId)) {
        return NextResponse.json(
          { error: "Not authorized for this approval step" },
          { status: 403 },
        );
      }
      const task = await prisma.task.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          approvalStepIndex: 0,
          returnComment: body.comment?.trim() || "Returned for changes",
        },
        include: taskDetailInclude,
      });
      return NextResponse.json(task);
    }

    if (body.action === "close") {
      // Final close after stack complete, or governance creator closing
      if (
        !canCreateDirective(perm) &&
        existing.createdById !== auth.user.id
      ) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (workClass === "DIRECTIVE") {
        const committeeChildren = existing.subtasks.filter(
          (s) => s.workClass === "COMMITTEE",
        );
        const incomplete = committeeChildren.filter((s) => s.status !== "DONE");
        if (incomplete.length > 0) {
          return NextResponse.json(
            {
              error:
                "All work under this directive must be accepted before closing it",
            },
            { status: 400 },
          );
        }
      }
      const task = await prisma.task.update({
        where: { id },
        data: { status: "DONE" },
        include: taskDetailInclude,
      });
      return NextResponse.json(task);
    }
  }

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
    // Personal: complete only
    if (
      existing.workClass === "PERSONAL" &&
      body.status === "DONE" &&
      !isEditor &&
      !isAssignee &&
      !isSubtaskCreator
    ) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  if (body.title !== undefined || body.description !== undefined || body.dueDate !== undefined) {
    if (!isEditor && !isAssignee && !isSubtaskCreator) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  if (body.workClass !== undefined) {
    const classErr = requireCommitteeForWorkClass(body.workClass, existing.committeeId);
    if (classErr) return classErr;
  }

  if (body.assignedToId) {
    const assigneeErr = await assertAssigneeInOrg(body.assignedToId, orgId);
    if (assigneeErr) return assigneeErr;
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...(body.status && { status: body.status }),
      ...(body.assignedToId !== undefined && { assignedToId: body.assignedToId }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.dueDate !== undefined && {
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      }),
      ...(body.workClass !== undefined && { workClass: body.workClass }),
    },
    include: taskDetailInclude,
  });

  if (body.status && body.status !== existing.status) {
    await logActivity({
      entityType: "TASK",
      entityId: task.id,
      action: "TASK_STATUS_CHANGED",
      actorId: auth.user.id,
      organizationId: orgId,
      metadata: { from: existing.status, to: body.status },
    });
  }

  return NextResponse.json(task);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const orgId = auth.org.organizationId;
  const existing = await prisma.task.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const mutation = assertTaskOrgMutation(auth.user, existing, orgId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  const canDelete = existing.committeeId
    ? canEditTasks(perm, existing.committeeId)
    : canCreateDirective(perm) || existing.createdById === auth.user.id;
  if (!canDelete) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertTaskOrgAccess(auth.user, existing, orgId);
  if (access) return access;

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
