import { NextResponse } from "next/server";
import {
  asPermissionUser,
  assertCommitteeAccess,
  requireUser,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  canActOnApprovalStep,
  currentApprovalStep,
  isApprovalStackComplete,
} from "@/lib/approval-stack";
import { prisma } from "@/lib/prisma";
import { getOrgSettings } from "@/lib/settings";
import {
  canAcceptAssignments,
  canApproveAssignmentReview,
  canCloseAssignment,
  canCreatePresbyteryAssignment,
  canCreateReferral,
  isPresbyteryHead,
  type AssignmentPriority,
  type AssignmentSource,
  type AssignmentStatus,
} from "@/lib/types";

const EDITABLE_STATUSES: AssignmentStatus[] = [
  "DRAFT",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "RETURNED",
  "CHAIR_APPROVED",
];

const assignmentIncludes = {
  createdBy: { select: { id: true, name: true } },
  targetCommittee: { select: { id: true, name: true, charterLetter: true } },
  sourceCommittee: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  accountableOwner: { select: { id: true, name: true } },
  projects: { select: { id: true, title: true, status: true } },
  rootTask: { select: { id: true, title: true } },
} as const;

async function loadApprovalStackForAssignment(assignment: {
  targetCommitteeId: string | null;
  organizationId?: string | null;
}): Promise<import("@/lib/types").ApprovalStackStep[]> {
  if (assignment.targetCommitteeId) {
    const committee = await prisma.committee.findUnique({
      where: { id: assignment.targetCommitteeId },
      select: { organizationId: true },
    });
    if (committee?.organizationId) {
      const settings = await getOrgSettings(committee.organizationId);
      return settings.approvalStack;
    }
  }
  if (assignment.organizationId) {
    const settings = await getOrgSettings(assignment.organizationId);
    return settings.approvalStack;
  }
  return [];
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const status = searchParams.get("status");
  const mineParam = searchParams.get("mine");
  const mine = mineParam === "true" || mineParam === "1";
  const assigneeParam = searchParams.get("assigneeUserId");
  const personal =
    mine || assigneeParam === "me" || assigneeParam === auth.user.id;
  const perm = asPermissionUser(auth.user);

  const where: Record<string, unknown> = {};

  if (personal) {
    where.assigneeUserId = auth.user.id;
  } else if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
    where.targetCommitteeId = committeeId;
  } else if (!canCreatePresbyteryAssignment(perm)) {
    const committeeIds = auth.user.committeeMemberships.map((m) => m.committeeId);
    where.OR = [
      { targetCommitteeId: { in: committeeIds } },
      { createdById: auth.user.id },
      { assigneeUserId: auth.user.id },
      { accountableOwnerId: auth.user.id },
    ];
  }

  if (status) where.status = status;
  if (assigneeParam && assigneeParam !== "me" && !mine) {
    where.assigneeUserId = assigneeParam;
  }

  const assignments = await prisma.assignment.findMany({
    where,
    include: assignmentIncludes,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(assignments);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    source?: AssignmentSource;
    targetCommitteeId?: string;
    assigneeUserId?: string;
    accountableOwnerId?: string;
    sourceCommitteeId?: string;
    parentAssignmentId?: string;
    priority?: AssignmentPriority;
    dueDate?: string;
    status?: AssignmentStatus;
  };

  if (!body.title || (!body.targetCommitteeId && !body.assigneeUserId)) {
    return NextResponse.json(
      { error: "title and targetCommitteeId or assigneeUserId required" },
      { status: 400 },
    );
  }

  const source = body.source ?? "SUPERVISORY";

  if (source === "SUPERVISORY" && !canCreatePresbyteryAssignment(perm)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (source === "COMMITTEE_REFERRAL") {
    if (!body.sourceCommitteeId) {
      return NextResponse.json({ error: "sourceCommitteeId required" }, { status: 400 });
    }
    if (!canCreateReferral(perm, body.sourceCommitteeId)) {
      return NextResponse.json({ error: "Only chairs may refer" }, { status: 403 });
    }
  }

  let accountableOwnerId = body.accountableOwnerId ?? null;
  const assigneeUserId = body.assigneeUserId ?? null;

  if (body.parentAssignmentId) {
    const parent = await prisma.assignment.findUnique({
      where: { id: body.parentAssignmentId },
      select: {
        id: true,
        assigneeUserId: true,
        accountableOwnerId: true,
      },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent assignment not found" }, { status: 404 });
    }
    if (!accountableOwnerId) {
      accountableOwnerId =
        parent.assigneeUserId ?? parent.accountableOwnerId ?? null;
    }
  }

  // Person-targeted: default accountable owner to the assignee
  if (assigneeUserId && !body.targetCommitteeId && !accountableOwnerId) {
    accountableOwnerId = assigneeUserId;
  }

  const status = body.status ?? "ASSIGNED";

  const assignment = await prisma.assignment.create({
    data: {
      title: body.title,
      description: body.description,
      source,
      status,
      priority: body.priority ?? "NORMAL",
      createdById: auth.user.id,
      targetCommitteeId: body.targetCommitteeId,
      assigneeUserId: assigneeUserId ?? undefined,
      accountableOwnerId: accountableOwnerId ?? undefined,
      sourceCommitteeId: body.sourceCommitteeId,
      parentAssignmentId: body.parentAssignmentId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      targetCommittee: { select: { id: true, name: true } },
      sourceCommittee: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      accountableOwner: { select: { id: true, name: true } },
    },
  });

  await logActivity({
    entityType: "ASSIGNMENT",
    entityId: assignment.id,
    action: status === "DRAFT" ? "DRAFTED" : "ASSIGNED",
    actorId: auth.user.id,
    metadata: { status, title: assignment.title },
  });

  return NextResponse.json(assignment, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const body = (await request.json()) as {
    id?: string;
    action?: string;
    title?: string;
    description?: string;
    priority?: AssignmentPriority;
    dueDate?: string | null;
    targetCommitteeId?: string;
    createdById?: string;
    returnComment?: string;
    convertType?: "project" | "task";
    convertTitle?: string;
  };

  if (!body.id || !body.action) {
    return NextResponse.json({ error: "id and action required" }, { status: 400 });
  }

  const existing = await prisma.assignment.findUnique({
    where: { id: body.id },
    include: { projects: { select: { id: true } }, rootTask: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  let newStatus: AssignmentStatus | undefined;
  const updates: Record<string, unknown> = {};

  switch (body.action) {
    case "assign":
      if (!canCloseAssignment(perm, existing.createdById)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      newStatus = "ASSIGNED";
      break;

    case "accept": {
      const canAcceptCommittee = existing.targetCommitteeId
        ? canAcceptAssignments(perm, existing.targetCommitteeId)
        : false;
      const canAcceptPerson = existing.assigneeUserId === auth.user.id;
      if (!canAcceptCommittee && !canAcceptPerson) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (existing.status !== "ASSIGNED") {
        return NextResponse.json(
          { error: "Only assigned work can be received" },
          { status: 400 },
        );
      }
      newStatus = "ACCEPTED";
      break;
    }

    case "convert":
      if (!existing.targetCommitteeId) {
        return NextResponse.json(
          { error: "Committee target required to convert" },
          { status: 400 },
        );
      }
      if (!canAcceptAssignments(perm, existing.targetCommitteeId)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (
        !["ACCEPTED", "IN_PROGRESS", "RETURNED"].includes(existing.status)
      ) {
        return NextResponse.json(
          { error: "Receive the assignment before creating a project" },
          { status: 400 },
        );
      }
      if (body.convertType === "project" || !body.convertType) {
        const project = await prisma.project.create({
          data: {
            title: body.convertTitle ?? existing.title,
            description: existing.description,
            committeeId: existing.targetCommitteeId,
            assignmentId: existing.id,
            createdById: auth.user.id,
          },
        });
        if (existing.status === "ACCEPTED" || existing.status === "RETURNED") {
          newStatus = "IN_PROGRESS";
        }
        await logActivity({
          entityType: "PROJECT",
          entityId: project.id,
          action: "CREATED_FROM_ASSIGNMENT",
          actorId: auth.user.id,
          metadata: { assignmentId: existing.id },
        });
      } else if (body.convertType === "task") {
        if (existing.rootTaskId) {
          return NextResponse.json(
            { error: "Assignment already has a root task" },
            { status: 400 },
          );
        }
        const task = await prisma.task.create({
          data: {
            title: body.convertTitle ?? existing.title,
            description: existing.description,
            committeeId: existing.targetCommitteeId,
            dueDate: existing.dueDate,
            createdById: auth.user.id,
          },
        });
        await prisma.assignment.update({
          where: { id: existing.id },
          data: { rootTaskId: task.id },
        });
        if (existing.status === "ACCEPTED" || existing.status === "RETURNED") {
          newStatus = "IN_PROGRESS";
        }
        await logActivity({
          entityType: "TASK",
          entityId: task.id,
          action: "CREATED_FROM_ASSIGNMENT",
          actorId: auth.user.id,
          metadata: { assignmentId: existing.id },
        });
      } else {
        return NextResponse.json({ error: "Invalid convertType" }, { status: 400 });
      }
      break;

    case "start_progress":
      newStatus = "IN_PROGRESS";
      break;

    case "submit_review":
      newStatus = "IN_REVIEW";
      break;

    case "escalate": {
      const stack = await loadApprovalStackForAssignment({
        targetCommitteeId: existing.targetCommitteeId,
        organizationId: auth.user.orgContext?.organizationId,
      });
      updates.approvalStepIndex = 0;
      if (isApprovalStackComplete(stack, 0)) {
        newStatus = existing.targetCommitteeId ? "CHAIR_APPROVED" : "CLOSED";
      } else {
        newStatus = "IN_REVIEW";
      }
      break;
    }

    case "approve_step": {
      const stack = await loadApprovalStackForAssignment({
        targetCommitteeId: existing.targetCommitteeId,
        organizationId: auth.user.orgContext?.organizationId,
      });
      const stepIndex = existing.approvalStepIndex ?? 0;
      const step = currentApprovalStep(stack, stepIndex);
      if (
        !canActOnApprovalStep(perm, step, existing.targetCommitteeId)
      ) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (existing.status !== "IN_REVIEW") {
        return NextResponse.json(
          { error: "Assignment is not in review" },
          { status: 400 },
        );
      }
      const nextIndex = stepIndex + 1;
      updates.approvalStepIndex = nextIndex;
      if (isApprovalStackComplete(stack, nextIndex)) {
        newStatus = existing.targetCommitteeId ? "CHAIR_APPROVED" : "CLOSED";
      }
      break;
    }

    case "approve":
      if (
        !existing.targetCommitteeId ||
        !canApproveAssignmentReview(perm, existing.targetCommitteeId)
      ) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      newStatus = "CHAIR_APPROVED";
      break;

    case "return":
      if (
        !existing.targetCommitteeId ||
        !canApproveAssignmentReview(perm, existing.targetCommitteeId)
      ) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (!body.returnComment?.trim()) {
        return NextResponse.json({ error: "Return comment required" }, { status: 400 });
      }
      newStatus = "RETURNED";
      updates.returnComment = body.returnComment.trim();
      break;

    case "close":
      if (!canCloseAssignment(perm, existing.createdById)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      newStatus = "CLOSED";
      break;

    case "cancel":
      if (!canCloseAssignment(perm, existing.createdById)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      newStatus = "CANCELLED";
      break;

    case "reassign_committee":
      if (
        !canCloseAssignment(perm, existing.createdById) &&
        !isPresbyteryHead(perm)
      ) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (!["ASSIGNED", "ACCEPTED"].includes(existing.status)) {
        return NextResponse.json({ error: "Cannot reassign at this stage" }, { status: 400 });
      }
      if (!body.targetCommitteeId) {
        return NextResponse.json({ error: "targetCommitteeId required" }, { status: 400 });
      }
      updates.targetCommitteeId = body.targetCommitteeId;
      newStatus = "ASSIGNED";
      break;

    case "transfer_originator":
      if (!isPresbyteryHead(perm) && perm.role !== "ORG_ADMIN") {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (!body.createdById) {
        return NextResponse.json({ error: "createdById required" }, { status: 400 });
      }
      updates.createdById = body.createdById;
      break;

    case "edit":
      if (!canCloseAssignment(perm, existing.createdById)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (!EDITABLE_STATUSES.includes(existing.status) || existing.status === "IN_REVIEW") {
        return NextResponse.json({ error: "Cannot edit at this stage" }, { status: 400 });
      }
      if (body.title) updates.title = body.title;
      if (body.description !== undefined) updates.description = body.description;
      if (body.priority) updates.priority = body.priority;
      if (body.dueDate !== undefined) {
        updates.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      }
      break;

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (newStatus) updates.status = newStatus;

  const assignment = await prisma.assignment.update({
    where: { id: existing.id },
    data: updates,
    include: assignmentIncludes,
  });

  if (newStatus || body.action === "approve_step" || body.action === "escalate") {
    await logActivity({
      entityType: "ASSIGNMENT",
      entityId: assignment.id,
      action: body.action.toUpperCase(),
      actorId: auth.user.id,
      metadata: {
        status: newStatus ?? assignment.status,
        returnComment: body.returnComment,
        approvalStepIndex: assignment.approvalStepIndex,
      },
    });
  }

  return NextResponse.json(assignment);
}
