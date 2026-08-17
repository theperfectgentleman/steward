import { prisma } from "@/lib/prisma";
import {
  asPermissionUser,
  type SessionUser,
} from "@/lib/auth";
import type { AttentionKind, AttentionUrgency } from "@/lib/types";
import { canApproveMinutes, canLogMinutes } from "@/lib/types";
import {
  canActOnApprovalStep,
  currentApprovalStep,
} from "@/lib/approval-stack";
import { getOrgSettings } from "@/lib/settings";
import { tasksPath } from "@/lib/navigation";

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

function isOverdue(dueDate: Date | null | undefined): boolean {
  if (!dueDate) return false;
  return dueDate.getTime() < Date.now();
}

function isDueSoon(dueDate: Date | null | undefined): boolean {
  if (!dueDate) return false;
  const inThreeDays = Date.now() + 3 * 24 * 60 * 60 * 1000;
  return dueDate.getTime() <= inThreeDays && dueDate.getTime() >= Date.now();
}

export async function buildAttentionItems(
  user: SessionUser,
): Promise<AttentionItem[]> {
  const perm = asPermissionUser(user);
  const items: AttentionItem[] = [];

  const orgId = user.orgContext?.organizationId;
  const myTasks = await prisma.task.findMany({
    where: {
      assignedToId: user.id,
      status: { not: "DONE" },
      parentId: null,
      ...(orgId ? { organizationId: orgId } : {}),
    },
    include: {
      committee: { select: { name: true, organizationId: true } },
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
      subtitle: task.committee?.name ?? "Personal",
      href: tasksPath(task.committeeId, { taskId: task.id }),
      primaryAction: {
        label: "Mark done",
        action: "mark_done",
        entityType: "TASK",
        entityId: task.id,
      },
    });
  }

  // Tasks waiting for this user's review on the current ladder step
  if (orgId) {
    const settings = await getOrgSettings(orgId);
    const inReview = await prisma.task.findMany({
      where: {
        status: "IN_REVIEW",
        parentId: null,
        workClass: { in: ["DIRECTIVE", "COMMITTEE"] },
        organizationId: orgId,
      },
      include: {
        committee: { select: { id: true, name: true } },
      },
      take: 40,
    });

    for (const task of inReview) {
      const stack =
        task.workClass === "DIRECTIVE"
          ? settings.directiveApprovalStack
          : settings.committeeApprovalStack;
      const step = currentApprovalStep(stack, task.approvalStepIndex);
      if (!canActOnApprovalStep(perm, step, task.committeeId)) continue;

      items.push({
        id: `review-${task.id}`,
        kind: "REVIEW",
        urgency: "NOW",
        title: task.title,
        subtitle: `Awaiting your review · ${task.committee?.name ?? "Committee"}`,
        href: tasksPath(task.committeeId, {
          taskId: task.id,
          filter: "waiting-review",
        }),
        primaryAction: {
          label: "Review",
          action: "approve_step",
          entityType: "TASK",
          entityId: task.id,
        },
      });
    }
  }

  for (const membership of user.committeeMemberships) {
    const { committeeId, title } = membership;

    if (canApproveMinutes(perm, committeeId)) {
      const pendingMinutes = await prisma.meeting.findMany({
        where: { committeeId, approved: false },
        include: { committee: { select: { name: true } } },
        take: 5,
      });

      for (const m of pendingMinutes) {
        const href = m.eventId
          ? `/events/${m.eventId}`
          : `/events?committeeId=${encodeURIComponent(committeeId)}`;
        items.push({
          id: `minutes-${m.id}`,
          kind: "MINUTES",
          urgency: "NOW",
          title: m.title,
          subtitle: `Approve minutes · ${m.committee?.name ?? "Committee"}`,
          href,
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
        const href = m.eventId
          ? `/events/${m.eventId}`
          : `/events?committeeId=${encodeURIComponent(committeeId)}`;
        items.push({
          id: `minutes-file-${m.id}`,
          kind: "MINUTES",
          urgency: "SOON",
          title: m.title,
          subtitle: "Finish filing minutes",
          href,
        });
      }
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
