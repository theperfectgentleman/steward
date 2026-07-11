import { NextResponse } from "next/server";
import {
  asPermissionUser,
  assertCommitteeAccess,
  requireUser,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import {
  canAcceptAssignments,
  canApproveAssignmentReview,
  canCloseAssignment,
  canCreatePresbyteryAssignment,
  canCreateReferral,
  canManagePresbyteryRoster,
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

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const status = searchParams.get("status");
  const mine = searchParams.get("mine") === "true";
  const perm = asPermissionUser(auth.user);

  const where: Record<string, unknown> = {};

  if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
    where.targetCommitteeId = committeeId;
  } else if (!canCreatePresbyteryAssignment(perm) && !mine) {
    const committeeIds = auth.user.committeeMemberships.map((m) => m.committeeId);
    where.OR = [
      { targetCommitteeId: { in: committeeIds } },
      { createdById: auth.user.id },
    ];
  }

  if (status) where.status = status;
  if (mine) where.createdById = auth.user.id;

  const assignments = await prisma.assignment.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true } },
      targetCommittee: { select: { id: true, name: true, charterLetter: true } },
      sourceCommittee: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
      rootTask: { select: { id: true, title: true } },
    },
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
    sourceCommitteeId?: string;
    parentAssignmentId?: string;
    priority?: AssignmentPriority;
    dueDate?: string;
    status?: AssignmentStatus;
  };

  if (!body.title || !body.targetCommitteeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const source = body.source ?? "PRESBYTERY";

  if (source === "PRESBYTERY" && !canCreatePresbyteryAssignment(perm)) {
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
      sourceCommitteeId: body.sourceCommitteeId,
      parentAssignmentId: body.parentAssignmentId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      targetCommittee: { select: { id: true, name: true } },
      sourceCommittee: { select: { id: true, name: true } },
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
    include: { project: true, rootTask: true },
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

    case "accept":
      if (!canAcceptAssignments(perm, existing.targetCommitteeId)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      newStatus = "ACCEPTED";
      break;

    case "convert":
      if (!canAcceptAssignments(perm, existing.targetCommitteeId)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (body.convertType === "project") {
        const project = await prisma.project.create({
          data: {
            title: body.convertTitle ?? existing.title,
            description: existing.description,
            committeeId: existing.targetCommitteeId,
            assignmentId: existing.id,
            createdById: auth.user.id,
          },
        });
        newStatus = "IN_PROGRESS";
        await logActivity({
          entityType: "PROJECT",
          entityId: project.id,
          action: "CREATED_FROM_ASSIGNMENT",
          actorId: auth.user.id,
          metadata: { assignmentId: existing.id },
        });
      } else {
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
        newStatus = "IN_PROGRESS";
        await logActivity({
          entityType: "TASK",
          entityId: task.id,
          action: "CREATED_FROM_ASSIGNMENT",
          actorId: auth.user.id,
          metadata: { assignmentId: existing.id },
        });
      }
      break;

    case "start_progress":
      newStatus = "IN_PROGRESS";
      break;

    case "submit_review":
      newStatus = "IN_REVIEW";
      break;

    case "approve":
      if (!canApproveAssignmentReview(perm, existing.targetCommitteeId)) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      newStatus = "CHAIR_APPROVED";
      break;

    case "return":
      if (!canApproveAssignmentReview(perm, existing.targetCommitteeId)) {
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
      if (!isPresbyteryHead(perm) && perm.role !== "SUPER_ADMIN") {
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
    include: {
      createdBy: { select: { id: true, name: true } },
      targetCommittee: { select: { id: true, name: true } },
      sourceCommittee: { select: { id: true, name: true } },
      project: { select: { id: true, title: true } },
      rootTask: { select: { id: true, title: true } },
    },
  });

  if (newStatus) {
    await logActivity({
      entityType: "ASSIGNMENT",
      entityId: assignment.id,
      action: body.action.toUpperCase(),
      actorId: auth.user.id,
      metadata: { status: newStatus, returnComment: body.returnComment },
    });
  }

  return NextResponse.json(assignment);
}
