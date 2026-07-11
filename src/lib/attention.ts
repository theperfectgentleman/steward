import { prisma } from "@/lib/prisma";
import {
  asPermissionUser,
  type SessionUser,
} from "@/lib/auth";
import type { AttentionKind, AttentionUrgency } from "@/lib/types";
import {
  canAcceptAssignments,
  canApproveAssignmentReview,
  canApproveMinutes,
  canCloseAssignment,
  canCreatePresbyteryAssignment,
  canEditTasks,
  canLogMinutes,
  canViewAllCommittees,
  getCommitteeTitle,
  isPresbyteryMember,
} from "@/lib/types";
import { committeePath } from "@/lib/navigation";

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  urgency: AttentionUrgency;
  title: string;
  subtitle: string;
  href: string;
  primaryAction?: {
    label: string;
    action: string;
    entityType: string;
    entityId: string;
  };
};

const ASSIGNED_ESCALATION_DAYS = 7;

function isOverdue(dueDate: Date | null | undefined): boolean {
  if (!dueDate) return false;
  return dueDate.getTime() < Date.now();
}

function isDueSoon(dueDate: Date | null | undefined): boolean {
  if (!dueDate) return false;
  const inThreeDays = Date.now() + 3 * 24 * 60 * 60 * 1000;
  return dueDate.getTime() <= inThreeDays && dueDate.getTime() >= Date.now();
}

function staleAssigned(createdAt: Date): boolean {
  const days =
    (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
  return days >= ASSIGNED_ESCALATION_DAYS;
}

export async function buildAttentionItems(
  user: SessionUser,
): Promise<AttentionItem[]> {
  const perm = asPermissionUser(user);
  const items: AttentionItem[] = [];

  const myTasks = await prisma.task.findMany({
    where: {
      assignedToId: user.id,
      status: { not: "DONE" },
      parentId: null,
    },
    include: {
      committee: { select: { name: true } },
      project: { select: { title: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  for (const task of myTasks) {
    const overdue = isOverdue(task.dueDate);
    items.push({
      id: `task-${task.id}`,
      kind: "TASK",
      urgency: overdue ? "NOW" : isDueSoon(task.dueDate) ? "SOON" : "NOW",
      title: task.title,
      subtitle: `${task.committee.name}${task.project ? ` · ${task.project.title}` : ""}`,
      href: `${committeePath(task.committeeId, "tasks")}?task=${task.id}`,
      primaryAction: {
        label: "Mark done",
        action: "mark_done",
        entityType: "TASK",
        entityId: task.id,
      },
    });
  }

  for (const membership of user.committeeMemberships) {
    const { committeeId, title } = membership;

    if (canAcceptAssignments(perm, committeeId)) {
      const inbox = await prisma.assignment.findMany({
        where: {
          targetCommitteeId: committeeId,
          status: "ASSIGNED",
        },
        include: {
          targetCommittee: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      for (const a of inbox) {
        items.push({
          id: `assign-inbox-${a.id}`,
          kind: a.source === "COMMITTEE_REFERRAL" ? "REFERRAL" : "ASSIGNMENT",
          urgency: staleAssigned(a.createdAt) || isOverdue(a.dueDate) ? "NOW" : "NOW",
          title: a.title,
          subtitle: `From ${a.createdBy.name} · ${a.targetCommittee.name}`,
          href: `/assignments/${a.id}?action=accept`,
          primaryAction: {
            label: "Accept",
            action: "accept",
            entityType: "ASSIGNMENT",
            entityId: a.id,
          },
        });
      }
    }

    if (canApproveAssignmentReview(perm, committeeId)) {
      const reviews = await prisma.assignment.findMany({
        where: {
          targetCommitteeId: committeeId,
          status: "IN_REVIEW",
        },
        include: { targetCommittee: { select: { name: true } } },
      });

      for (const a of reviews) {
        items.push({
          id: `assign-review-${a.id}`,
          kind: "REVIEW",
          urgency: "NOW",
          title: a.title,
          subtitle: `Awaiting chair approval · ${a.targetCommittee.name}`,
          href: `/assignments/${a.id}?action=approve`,
          primaryAction: {
            label: "Approve",
            action: "approve",
            entityType: "ASSIGNMENT",
            entityId: a.id,
          },
        });
      }
    }

    if (canApproveMinutes(perm, committeeId)) {
      const pendingMinutes = await prisma.meeting.findMany({
        where: { committeeId, approved: false },
        include: { committee: { select: { name: true } } },
        take: 5,
      });

      for (const m of pendingMinutes) {
        items.push({
          id: `minutes-${m.id}`,
          kind: "MINUTES",
          urgency: "NOW",
          title: m.title,
          subtitle: `Approve minutes · ${m.committee.name}`,
          href: `${committeePath(committeeId, "minutes")}?meeting=${m.id}`,
          primaryAction: {
            label: "Review minutes",
            action: "review_minutes",
            entityType: "MEETING",
            entityId: m.id,
          },
        });
      }
    }

    if (canLogMinutes(perm, committeeId) && title === "SECRETARY") {
      const recentUnfiled = await prisma.meeting.findMany({
        where: {
          committeeId,
          approved: false,
          createdById: user.id,
        },
        take: 3,
      });

      for (const m of recentUnfiled) {
        items.push({
          id: `minutes-file-${m.id}`,
          kind: "MINUTES",
          urgency: "SOON",
          title: m.title,
          subtitle: "Finish filing minutes",
          href: `${committeePath(committeeId, "minutes")}?meeting=${m.id}`,
        });
      }
    }
  }

  if (canCreatePresbyteryAssignment(perm)) {
    const toClose = await prisma.assignment.findMany({
      where: {
        createdById: user.id,
        status: "CHAIR_APPROVED",
      },
      include: { targetCommittee: { select: { name: true } } },
    });

    for (const a of toClose) {
      items.push({
        id: `assign-close-${a.id}`,
        kind: "ASSIGNMENT",
        urgency: "NOW",
        title: a.title,
        subtitle: `Awaiting your close · ${a.targetCommittee.name}`,
        href: `/assignments/${a.id}?action=close`,
        primaryAction: {
          label: "Close",
          action: "close",
          entityType: "ASSIGNMENT",
          entityId: a.id,
        },
      });
    }

    const drafts = await prisma.assignment.findMany({
      where: { createdById: user.id, status: "DRAFT" },
      include: { targetCommittee: { select: { name: true } } },
    });

    for (const a of drafts) {
      items.push({
        id: `assign-draft-${a.id}`,
        kind: "ASSIGNMENT",
        urgency: "SOON",
        title: a.title,
        subtitle: `Draft · ${a.targetCommittee.name}`,
        href: `/assignments/${a.id}`,
        primaryAction: {
          label: "Assign",
          action: "assign",
          entityType: "ASSIGNMENT",
          entityId: a.id,
        },
      });
    }
  }

  if (isPresbyteryMember(perm) || canViewAllCommittees(perm)) {
    const inProgress = await prisma.assignment.findMany({
      where: {
        status: { in: ["IN_PROGRESS", "RETURNED", "ACCEPTED"] },
        ...(canCloseAssignment(perm, user.id)
          ? {}
          : { NOT: { createdById: user.id } }),
      },
      include: {
        targetCommittee: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
    });

    for (const a of inProgress) {
      if (items.some((i) => i.id === `assign-wait-${a.id}`)) continue;
      items.push({
        id: `assign-wait-${a.id}`,
        kind: "ASSIGNMENT",
        urgency: "WAITING",
        title: a.title,
        subtitle: `${a.status.replace(/_/g, " ")} · ${a.targetCommittee.name}`,
        href: `/assignments/${a.id}`,
      });
    }
  }

  const urgencyOrder: Record<AttentionUrgency, number> = {
    NOW: 0,
    SOON: 1,
    WAITING: 2,
    FYI: 3,
  };

  return items.sort(
    (a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency],
  );
}
