import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  asPermissionUser,
  canAccessCommittee,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllCommittees } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");

  if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  }

  const committees = await prisma.committee.findMany({
    where: committeeId
      ? { id: committeeId }
      : canViewAllCommittees(perm)
        ? undefined
        : {
            id: {
              in: auth.user.committeeMemberships.map((m) => m.committeeId),
            },
          },
    include: {
      tasks: { select: { status: true } },
      projects: { select: { status: true } },
      _count: { select: { meetings: true } },
    },
    orderBy: { charterLetter: "asc" },
  });

  const assignmentFilter = committeeId
    ? { targetCommitteeId: committeeId }
    : canViewAllCommittees(perm)
      ? {}
      : {
          targetCommitteeId: {
            in: auth.user.committeeMemberships.map((m) => m.committeeId),
          },
        };

  const assignments = await prisma.assignment.groupBy({
    by: ["status"],
    where: assignmentFilter,
    _count: true,
  });

  const stats = committees.map((c) => {
    const total = c.tasks.length;
    const done = c.tasks.filter((t) => t.status === "DONE").length;
    const blocked = c.tasks.filter((t) => t.status === "BLOCKED").length;
    const activeProjects = c.projects.filter((p) => p.status === "ACTIVE").length;
    return {
      id: c.id,
      charterLetter: c.charterLetter,
      name: c.name,
      total,
      done,
      blocked,
      activeProjects,
      meetingCount: c._count.meetings,
    };
  });

  const committeeFilter = committeeId
    ? { committeeId }
    : canViewAllCommittees(perm)
      ? {}
      : {
          committeeId: {
            in: auth.user.committeeMemberships.map((m) => m.committeeId),
          },
        };

  const recentTasks = await prisma.task.findMany({
    where: { status: { in: ["BLOCKED", "DONE"] }, ...committeeFilter },
    include: { committee: { select: { name: true, id: true } } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const pendingMinutes = await prisma.meeting.findMany({
    where: { approved: false, ...committeeFilter },
    include: { committee: { select: { name: true, id: true } } },
    orderBy: { date: "desc" },
    take: 5,
  });

  const recentAssignments = await prisma.assignment.findMany({
    where: assignmentFilter,
    include: {
      targetCommittee: { select: { name: true, id: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  const pendingAssignments = await prisma.assignment.count({
    where: {
      ...assignmentFilter,
      status: "ASSIGNED",
    },
  });

  const myOpenTasks = await prisma.task.count({
    where: {
      assignedToId: auth.user.id,
      status: { not: "DONE" },
      parentId: null,
      ...(committeeId ? { committeeId } : {}),
    },
  });

  const awaitingMyClose = await prisma.assignment.findMany({
    where: {
      createdById: auth.user.id,
      status: "CHAIR_APPROVED",
    },
    include: {
      targetCommittee: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const myAssignmentDrafts = await prisma.assignment.count({
    where: { createdById: auth.user.id, status: "DRAFT" },
  });

  const pendingInbox = committeeId
    ? await prisma.assignment.findMany({
        where: {
          targetCommitteeId: committeeId,
          status: "ASSIGNED",
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  const myOpenTaskList = committeeId
    ? await prisma.task.findMany({
        where: {
          committeeId,
          assignedToId: auth.user.id,
          status: { not: "DONE" },
          parentId: null,
        },
        select: { id: true, title: true, status: true, dueDate: true },
        orderBy: { dueDate: "asc" },
        take: 5,
      })
    : [];

  const timelineGoals = await prisma.timelineGoal.findMany({
    where: committeeFilter,
    include: { committee: { select: { id: true, name: true, charterLetter: true } } },
    orderBy: { startDate: "asc" },
  });

  const alerts = [
    ...recentTasks
      .filter((t) => t.status === "BLOCKED")
      .map((t) => ({
        id: `blocked-${t.id}`,
        type: "blocked" as const,
        message: `${t.committee.name}: ${t.title} is awaiting`,
        time: t.updatedAt.toISOString(),
        href: "/tasks",
        committeeId: t.committee.id,
      })),
    ...recentTasks
      .filter((t) => t.status === "DONE")
      .slice(0, 3)
      .map((t) => ({
        id: `done-${t.id}`,
        type: "completed" as const,
        message: `${t.committee.name} completed ${t.title}`,
        time: t.updatedAt.toISOString(),
        href: "/tasks",
        committeeId: t.committee.id,
      })),
    ...pendingMinutes.map((m) => ({
      id: `minutes-${m.id}`,
      type: "minutes" as const,
      message: `${m.committee?.name ?? "Committee"} minutes filed — pending review`,
      time: m.date.toISOString(),
      href: m.eventId
        ? `/c/${m.committeeId}/schedule/${m.eventId}`
        : m.committeeId
          ? `/c/${m.committeeId}/schedule`
          : "/schedule",
      committeeId: m.committee?.id ?? m.committeeId ?? undefined,
      meetingId: m.id,
    })),
    ...recentAssignments.map((a) => ({
      id: `assignment-${a.id}`,
      type: "assignment" as const,
      message: `${a.targetCommittee?.name ?? "Personal"}: ${a.title} — ${a.status.replace(/_/g, " ").toLowerCase()}`,
      time: a.updatedAt.toISOString(),
      href: `/assignments/${a.id}`,
      committeeId: a.targetCommittee?.id,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const visibleAlerts = canViewAllCommittees(perm)
    ? alerts
    : alerts.filter(
        (a) =>
          !a.committeeId || canAccessCommittee(auth.user, a.committeeId),
      );

  return NextResponse.json({
    stats,
    alerts: visibleAlerts,
    assignmentPipeline: assignments,
    pendingAssignments,
    myOpenTasks,
    awaitingMyClose,
    myAssignmentDrafts,
    pendingInbox,
    myOpenTaskList,
    timelineGoals,
  });
}
