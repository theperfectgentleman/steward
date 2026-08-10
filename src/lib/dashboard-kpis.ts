import type { AlertItem } from "@/components/AlertFeed";
import type { DashboardStat } from "@/components/DashboardStatsPanel";
import {
  eventsPath,
  tasksPath,
} from "@/lib/navigation";
import type { PermissionUser } from "@/lib/types";
import {
  canApproveMinutes,
  canCreateDirective,
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
  openDirectives,
  awaitingCloseCount,
  directiveDrafts,
  upcomingEvents = 0,
  myOpenTasks = 0,
  perm,
}: {
  stats: CommitteeStat[];
  alerts: AlertItem[];
  totals: { total: number; done: number; blocked: number };
  pendingMinutes: number;
  openDirectives: number;
  awaitingCloseCount: number;
  directiveDrafts: number;
  upcomingEvents?: number;
  myOpenTasks?: number;
  perm: PermissionUser | null;
}): { attention: DashboardStat[]; snapshot: DashboardStat[] } {
  const isExecutive = perm ? canViewAllCommittees(perm) : false;
  const canManageDirectives = perm ? canCreateDirective(perm) : false;
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

  if (myOpenTasks > 0) {
    attention.push({
      key: "my-tasks",
      label: "Your open work",
      value: myOpenTasks,
      hint: "Assigned to you",
      href: tasksPath(null, { filter: "needs-me" }),
      accent: "gold",
      active: true,
    });
  }

  if (canManageDirectives && openDirectives > 0) {
    attention.push({
      key: "in-review",
      label: "Work in review",
      value: openDirectives,
      hint: "Waiting on approval ladders",
      href: tasksPath(null, { filter: "waiting-review" }),
      accent: "gold",
      active: true,
    });
  }

  void awaitingCloseCount;
  void directiveDrafts;

  if (!isExecutive && actionableAwaiting > 0) {
    attention.push({
      key: "awaiting-action",
      label: "Work waiting on you",
      value: actionableAwaiting,
      hint: "In groups you chair",
      href: links.awaiting,
      accent: "gold",
      active: true,
    });
  }

  const pct = totals.total ? Math.round((totals.done / totals.total) * 100) : 0;

  snapshot.push({
    key: "committees",
    label: isExecutive ? "Groups overseen" : "Your groups",
    value: stats.length,
    hint: "Tap a card to open Work",
    href: links.committees,
    accent: "charcoal",
  });

  snapshot.push({
    key: "progress",
    label: "Work progress",
    value: totals.total ? `${totals.done}/${totals.total}` : "—",
    hint: totals.total ? `${pct}% complete overall` : "No work yet",
    href: tasksPath(),
    accent: "lime",
  });

  if (upcomingEvents > 0) {
    snapshot.push({
      key: "events",
      label: "Upcoming events",
      value: upcomingEvents,
      hint: "Meetings and events ahead",
      href: eventsPath(),
      accent: "charcoal",
    });
  }

  if (isExecutive && churchPendingMinutes > 0) {
    snapshot.push({
      key: "minutes-chairs",
      label: "Minutes with chairs",
      value: churchPendingMinutes,
      hint: "Filed by secretaries — chairs approve",
      href: "#dashboard-alerts",
      accent: "charcoal",
    });
  }

  if (watchAwaiting > 0) {
    snapshot.push({
      key: "awaiting-watch",
      label: isExecutive ? "Work waiting elsewhere" : "Work waiting on others",
      value: watchAwaiting,
      hint: isExecutive
        ? "Groups handle these — you can view"
        : "Outside groups you chair",
      href: links.awaiting,
      accent: "charcoal",
    });
  }

  return { attention, snapshot };
}

export function buildCommitteeDashboardStats({
  committeeId,
  stats,
  pendingTasks,
  perm,
}: {
  committeeId: string;
  stats: {
    total: number;
    done: number;
    blocked: number;
    activeProjects?: number;
  } | null;
  pendingTasks: number;
  perm: PermissionUser | null;
}): { attention: DashboardStat[]; snapshot: DashboardStat[] } {
  const links = buildCommitteeKpiLinks(committeeId, stats);
  const canEdit =
    perm && committeeId
      ? getCommitteeTitle(perm, committeeId) === "CHAIR" ||
        getCommitteeTitle(perm, committeeId) === "SECRETARY"
      : false;

  const attention: DashboardStat[] = [];
  const snapshot: DashboardStat[] = [];
  const openTasks = stats ? stats.total - stats.done : 0;
  const pct = stats?.total ? Math.round((stats.done / stats.total) * 100) : 0;

  if (pendingTasks > 0) {
    attention.push({
      key: "inbox",
      label: "Needs attention",
      value: pendingTasks,
      hint: "Open Work to review",
      href: tasksPath(committeeId, { filter: "needs-me" }),
      accent: "gold",
      active: true,
    });
  }

  if (canEdit && stats && stats.blocked > 0) {
    attention.push({
      key: "awaiting",
      label: "Work waiting on others",
      value: stats.blocked,
      hint: "Tap to review on the board",
      href: links.awaiting,
      accent: "gold",
      active: true,
    });
  }

  snapshot.push({
    key: "progress",
    label: "Work progress",
    value: stats ? `${stats.done}/${stats.total}` : "—",
    hint: stats?.total ? `${pct}% complete` : undefined,
    href: links.tasksDone,
    accent: "lime",
  });

  snapshot.push({
    key: "open",
    label: "Still in progress",
    value: openTasks,
    hint: "Open work",
    href: links.openTasks,
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

  const myMinutesHref = firstMyMinutes?.href;

  return {
    committees: stats.length > 0 ? "#dashboard-committees" : undefined,
    tasksComplete: tasksPath(),
    awaiting: awaitingHref,
    myPendingMinutes: myMinutesHref,
    openDirectives: isExecutive ? tasksPath(null, { filter: "waiting-review" }) : undefined,
  };
}

function buildCommitteeKpiLinks(
  committeeId: string,
  stats: { blocked: number } | null,
) {
  return {
    tasksDone: tasksPath(committeeId),
    awaiting:
      stats && stats.blocked > 0
        ? tasksPath(committeeId, { column: "BLOCKED", filter: "all" })
        : undefined,
    openTasks: tasksPath(committeeId, { filter: "all" }),
  };
}
