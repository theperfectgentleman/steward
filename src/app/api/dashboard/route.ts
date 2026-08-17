import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  asPermissionUser,
  canAccessCommittee,
  requireActiveOrg,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllCommittees } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const orgId = auth.org.organizationId;
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");

  if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  }

  const committeeWhere = {
    organizationId: orgId,
    ...(committeeId
      ? { id: committeeId }
      : canViewAllCommittees(perm)
        ? {}
        : {
            id: {
              in: auth.user.committeeMemberships.map((m) => m.committeeId),
            },
          }),
  };

  const committees = await prisma.committee.findMany({
    where: committeeWhere,
    include: {
      tasks: { select: { status: true }, where: { parentId: null } },
      _count: {
        select: {
          events: {
            where: { startDate: { gte: new Date() } },
          },
        },
      },
    },
    orderBy: { charterLetter: "asc" },
  });

  const torDocs = await prisma.libraryDocument.findMany({
    where: {
      tag: "TOR",
      archivedAt: null,
      committeeId: { in: committees.map((c) => c.id) },
    },
    select: { id: true, committeeId: true, title: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const torByCommittee = new Map<string, { id: string; title: string }>();
  for (const tor of torDocs) {
    if (!tor.committeeId || torByCommittee.has(tor.committeeId)) continue;
    torByCommittee.set(tor.committeeId, { id: tor.id, title: tor.title });
  }

  const stats = committees.map((c) => {
    const total = c.tasks.length;
    const todo = c.tasks.filter((t) => t.status === "TODO").length;
    const inProgress = c.tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const done = c.tasks.filter((t) => t.status === "DONE").length;
    const blocked = c.tasks.filter((t) => t.status === "BLOCKED").length;
    const inReview = c.tasks.filter((t) => (t.status as string) === "IN_REVIEW").length;
    const tor = torByCommittee.get(c.id) ?? null;
    return {
      id: c.id,
      charterLetter: c.charterLetter,
      name: c.name,
      total,
      todo,
      inProgress,
      done,
      blocked,
      inReview,
      upcomingEvents: c._count.events,
      torDocumentId: tor?.id ?? null,
      torTitle: tor?.title ?? null,
    };
  });

  const committeeFilter = {
    organizationId: orgId,
    ...(committeeId
      ? { committeeId }
      : canViewAllCommittees(perm)
        ? {}
        : {
            committeeId: {
              in: auth.user.committeeMemberships.map((m) => m.committeeId),
            },
          }),
  };

  const recentTasks = await prisma.task.findMany({
    where: {
      status: { in: ["BLOCKED", "DONE", "IN_PROGRESS"] },
      parentId: null,
      ...committeeFilter,
    },
    include: { committee: { select: { name: true, id: true } } },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  const pendingMinutes = await prisma.meeting.findMany({
    where: {
      approved: false,
      ...(committeeId
        ? { committeeId }
        : {
            OR: [
              { committee: { organizationId: orgId } },
              { event: { organizationId: orgId } },
            ],
          }),
    },
    include: { committee: { select: { name: true, id: true } } },
    orderBy: { date: "desc" },
    take: 5,
  });

  const myOpenTasks = await prisma.task.count({
    where: {
      organizationId: orgId,
      assignedToId: auth.user.id,
      status: { notIn: ["DONE"] },
      parentId: null,
      ...(committeeId ? { committeeId } : {}),
    },
  });

  let tasksInReview = 0;
  try {
    tasksInReview = await prisma.task.count({
      where: {
        status: "IN_REVIEW" as never,
        parentId: null,
        ...committeeFilter,
      },
    });
  } catch {
    tasksInReview = 0;
  }

  const upcomingEvents = await prisma.event.count({
    where: {
      startDate: { gte: new Date() },
      ...committeeFilter,
    },
  });

  const alerts = [
    ...recentTasks
      .filter((t) => t.status === "BLOCKED")
      .map((t) => ({
        id: `blocked-${t.id}`,
        type: "blocked" as const,
        message: `${t.title} is awaiting`,
        time: t.updatedAt.toISOString(),
        href: t.committee
          ? `/tasks?committeeId=${t.committee.id}&column=BLOCKED`
          : `/tasks/${t.id}`,
        committeeId: t.committee?.id,
        committeeName: t.committee?.name ?? "Personal",
      })),
    ...recentTasks
      .filter((t) => t.status === "DONE")
      .slice(0, 3)
      .map((t) => ({
        id: `done-${t.id}`,
        type: "completed" as const,
        message: `Completed ${t.title}`,
        time: t.updatedAt.toISOString(),
        href: t.committee ? `/tasks?committeeId=${t.committee.id}` : `/tasks/${t.id}`,
        committeeId: t.committee?.id,
        committeeName: t.committee?.name ?? "Personal",
      })),
    ...pendingMinutes.map((m) => ({
      id: `minutes-${m.id}`,
      type: "minutes" as const,
      message: `Minutes filed — pending review`,
      time: m.date.toISOString(),
      href: m.eventId
        ? `/events/${m.eventId}`
        : `/events?committeeId=${m.committeeId}`,
      committeeId: m.committee?.id ?? m.committeeId ?? undefined,
      committeeName: m.committee?.name ?? "Committee",
      meetingId: m.id,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const visibleAlerts = canViewAllCommittees(perm)
    ? alerts
    : alerts.filter(
        (a) => !a.committeeId || canAccessCommittee(auth.user, a.committeeId),
      );

  const timelineGoals = canViewAllCommittees(perm)
    ? await prisma.timelineGoal.findMany({
        where: committeeId
          ? { committeeId }
          : { committee: { organizationId: orgId } },
        include: {
          committee: {
            select: { id: true, name: true, charterLetter: true },
          },
        },
        orderBy: { startDate: "asc" },
      })
    : [];

  return NextResponse.json({
    stats,
    alerts: visibleAlerts,
    myOpenTasks,
    tasksInReview,
    upcomingEvents,
    timelineGoals,
  });
}
