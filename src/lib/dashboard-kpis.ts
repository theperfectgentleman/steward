import type { AlertItem } from "@/components/AlertFeed";
import type { DashboardStat } from "@/components/DashboardStatsPanel";
import {
  committeePath,
  meetingPath,
  presbyteryAssignmentsPath,
  tasksPath,
} from "@/lib/navigation";
import type { PermissionUser } from "@/lib/types";
import {
  canAcceptAssignments,
  canApproveMinutes,
  canCreatePresbyteryAssignment,
  canViewAllCommittees,
  getCommitteeTitle,
} from "@/lib/types";

type CommitteeStat = {
  id: string;
  charterLetter?: string;
  name?: string;
  total: number;
  done: number;
  blocked: number;
};

function minutesAlertsForUser(alerts: AlertItem[], perm: PermissionUser | null) {
  const minutesAlerts = alerts.filter((a) => a.type === "minutes");
  const mine = minutesAlerts.filter(
    (a) => a.committeeId && perm && canApproveMinutes(perm, a.committeeId),
  );
  return { all: minutesAlerts, mine };
}

export function buildOverallDashboardStats({
  stats,
  alerts,
  totals,
  pendingMinutes,
  openAssignments,
  awaitingCloseCount,
  assignmentDrafts,
  perm,
}: {
  stats: CommitteeStat[];
  alerts: AlertItem[];
  totals: { total: number; done: number; blocked: number };
  pendingMinutes: number;
  openAssignments: number;
  awaitingCloseCount: number;
  assignmentDrafts: number;
  perm: PermissionUser | null;
}): { attention: DashboardStat[]; snapshot: DashboardStat[] } {
  const isExecutive = perm ? canViewAllCommittees(perm) : false;
  const canManageAssignments = perm ? canCreatePresbyteryAssignment(perm) : false;
  const { mine: myMinutesAlerts } = minutesAlertsForUser(alerts, perm);
  const myPendingMinutes = myMinutesAlerts.length;
  const churchPendingMinutes = Math.max(0, pendingMinutes - myPendingMinutes);

  const chairCommitteeIds = new Set(
    perm?.committeeMemberships
      .filter((m) => getCommitteeTitle(perm, m.committeeId) === "CHAIR")
      .map((m) => m.committeeId) ?? [],
  );
  const actionableAwaiting = stats
    .filter((s) => s.blocked > 0 && !isExecutive && chairCommitteeIds.has(s.id))
    .reduce((n, s) => n + s.blocked, 0);
  const watchAwaiting = isExecutive ? totals.blocked : totals.blocked - actionableAwaiting;

  const firstMyMinutes = myMinutesAlerts[0];
  const links = buildOverallKpiLinks({
    stats,
    alerts,
    totals,
    firstMyMinutes,
    isExecutive,
  });

  const attention: DashboardStat[] = [];
  const snapshot: DashboardStat[] = [];

  if (myPendingMinutes > 0) {
    attention.push({
      key: "minutes",
      label: "Minutes to approve",
      value: myPendingMinutes,
      hint: "You are the chair — tap to review",
      href: links.myPendingMinutes,
      accent: "gold",
      active: true,
    });
  }

  if (canManageAssignments) {
    if (awaitingCloseCount > 0) {
      attention.push({
        key: "close",
        label: "Ready for you to close",
        value: awaitingCloseCount,
        hint: "You issued these — chair has approved",
        href: "#dashboard-awaiting-close",
        accent: "gold",
        active: true,
      });
    }

    if (assignmentDrafts > 0) {
      attention.push({
        key: "drafts",
        label: "Directive drafts",
        value: assignmentDrafts,
        hint: "Finish and send to committees",
        href: presbyteryAssignmentsPath("open", true),
        accent: "gold",
        active: true,
      });
    }
  }

  if (!isExecutive && actionableAwaiting > 0) {
    attention.push({
      key: "awaiting-action",
      label: "Tasks waiting on you",
      value: actionableAwaiting,
      hint: "In committees you chair",
      href: links.awaiting,
      accent: "gold",
      active: true,
    });
  }

  const pct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;

  snapshot.push({
    key: "committees",
    label: isExecutive ? "Committees overseen" : "Your committees",
    value: stats.length,
    hint: "Tap to browse each one",
    href: links.committees,
    accent: "charcoal",
  });

  snapshot.push({
    key: "progress",
    label: "Task progress",
    value: totals.total ? `${totals.done}/${totals.total}` : "—",
    hint: totals.total ? `${pct}% complete overall` : "No tasks yet",
    href: links.tasksComplete,
    accent: "lime",
  });

  if (isExecutive && churchPendingMinutes > 0) {
    snapshot.push({
      key: "minutes-chairs",
      label: "Minutes with chairs",
      value: churchPendingMinutes,
      hint: "Filed by secretaries — chairs approve, not presbytery",
      href: "#dashboard-alerts",
      accent: "charcoal",
    });
  }

  if (isExecutive && openAssignments > 0) {
    snapshot.push({
      key: "pipeline",
      label: "Directives in progress",
      value: openAssignments,
      hint: "Church-wide pipeline — mostly for visibility",
      href: presbyteryAssignmentsPath("open"),
      accent: "charcoal",
    });
  }

  if (watchAwaiting > 0) {
    snapshot.push({
      key: "awaiting-watch",
      label: isExecutive ? "Tasks waiting elsewhere" : "Tasks waiting on others",
      value: watchAwaiting,
      hint: isExecutive
        ? "Committees handle these — you can view only"
        : "Outside committees you chair",
      href: links.awaiting,
      accent: "charcoal",
    });
  } else if (!isExecutive && totals.blocked === 0) {
    snapshot.push({
      key: "awaiting-clear",
      label: "Tasks waiting on others",
      value: 0,
      hint: "Nothing on hold",
      accent: "charcoal",
    });
  }

  return { attention, snapshot };
}

export function buildCommitteeDashboardStats({
  committeeId,
  stats,
  pendingAssignments,
  perm,
}: {
  committeeId: string;
  stats: {
    total: number;
    done: number;
    blocked: number;
    activeProjects?: number;
  } | null;
  pendingAssignments: number;
  perm: PermissionUser | null;
}): { attention: DashboardStat[]; snapshot: DashboardStat[] } {
  const links = buildCommitteeKpiLinks(committeeId, stats);
  const canInbox =
    perm && committeeId ? canAcceptAssignments(perm, committeeId) : false;
  const canEdit =
    perm && committeeId
      ? getCommitteeTitle(perm, committeeId) === "CHAIR" ||
        getCommitteeTitle(perm, committeeId) === "SECRETARY"
      : false;

  const attention: DashboardStat[] = [];
  const snapshot: DashboardStat[] = [];
  const openTasks = stats ? stats.total - stats.done : 0;
  const pct = stats?.total ? Math.round((stats.done / stats.total) * 100) : 0;

  if (canInbox) {
    attention.push({
      key: "inbox",
      label: "New assignments",
      value: pendingAssignments,
      hint:
        pendingAssignments > 0
          ? "Receive assignments that need action"
          : "No pending assignments",
      href:
        pendingAssignments > 0
          ? committeePath(committeeId, "assignments")
          : undefined,
      accent: "gold",
      active: pendingAssignments > 0,
    });
  }

  if (canEdit && stats && stats.blocked > 0) {
    attention.push({
      key: "awaiting",
      label: "Tasks waiting on others",
      value: stats.blocked,
      hint: "Tap to review on the board",
      href: links.awaiting,
      accent: "gold",
      active: true,
    });
  }

  snapshot.push({
    key: "progress",
    label: "Task progress",
    value: stats ? `${stats.done}/${stats.total}` : "—",
    hint: stats?.total ? `${pct}% complete` : undefined,
    href: links.tasksDone,
    accent: "lime",
  });

  snapshot.push({
    key: "open",
    label: "Still in progress",
    value: openTasks,
    hint: "Open tasks on the board",
    href: links.openTasks,
    accent: "charcoal",
  });

  snapshot.push({
    key: "projects",
    label: "Active projects",
    value: stats?.activeProjects ?? 0,
    hint: "Ongoing committee work",
    href: links.projects,
    accent: "charcoal",
  });

  return { attention, snapshot };
}

function buildOverallKpiLinks({
  stats,
  alerts,
  totals,
  firstMyMinutes,
  isExecutive,
}: {
  stats: CommitteeStat[];
  alerts: AlertItem[];
  totals: { blocked: number };
  firstMyMinutes?: AlertItem;
  isExecutive: boolean;
}) {
  const firstAwaiting = alerts.find((a) => a.type === "blocked");

  const awaitingHref =
    totals.blocked > 0 && firstAwaiting?.committeeId
      ? tasksPath(firstAwaiting.committeeId, {
          column: "BLOCKED",
          filter: "all",
          taskId: firstAwaiting.id.startsWith("blocked-")
            ? firstAwaiting.id.slice("blocked-".length)
            : undefined,
        })
      : totals.blocked > 0
        ? "#dashboard-alerts"
        : undefined;

  const myMinutesHref =
    firstMyMinutes?.committeeId && firstMyMinutes.meetingId
      ? meetingPath(firstMyMinutes.committeeId, firstMyMinutes.meetingId)
      : undefined;

  return {
    committees: stats.length > 0 ? "#dashboard-committees" : undefined,
    tasksComplete: stats.length > 0 ? "#dashboard-committees" : undefined,
    awaiting: awaitingHref,
    myPendingMinutes: myMinutesHref,
    openAssignments: isExecutive ? presbyteryAssignmentsPath("open") : undefined,
  };
}

function buildCommitteeKpiLinks(
  committeeId: string,
  stats: { blocked: number } | null,
) {
  return {
    tasksDone: committeePath(committeeId, "tasks"),
    awaiting:
      stats && stats.blocked > 0
        ? tasksPath(committeeId, { column: "BLOCKED", filter: "all" })
        : undefined,
    openTasks: `${committeePath(committeeId, "tasks")}?filter=all`,
    projects: committeePath(committeeId, "projects"),
  };
}
