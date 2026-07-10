import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  canAccessCommittee,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllCommittees } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");

  if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  }

  const committees = await prisma.committee.findMany({
    where: committeeId
      ? { id: committeeId }
      : canViewAllCommittees(auth.user.role)
        ? undefined
        : {
            id: {
              in: auth.user.committeeMemberships.map((m) => m.committeeId),
            },
          },
    include: {
      tasks: { select: { status: true } },
      _count: { select: { meetings: true } },
    },
    orderBy: { charterLetter: "asc" },
  });

  const stats = committees.map((c) => {
    const total = c.tasks.length;
    const done = c.tasks.filter((t) => t.status === "DONE").length;
    const blocked = c.tasks.filter((t) => t.status === "BLOCKED").length;
    return {
      id: c.id,
      charterLetter: c.charterLetter,
      name: c.name,
      total,
      done,
      blocked,
      meetingCount: c._count.meetings,
    };
  });

  const committeeFilter = committeeId
    ? { committeeId }
    : canViewAllCommittees(auth.user.role)
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

  const alerts = [
    ...recentTasks
      .filter((t) => t.status === "BLOCKED")
      .map((t) => ({
        id: `blocked-${t.id}`,
        type: "blocked" as const,
        message: `${t.committee.name}: ${t.title} is blocked`,
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
      message: `${m.committee.name} minutes filed — pending review`,
      time: m.date.toISOString(),
      href: "/minutes",
      committeeId: m.committee.id,
      meetingId: m.id,
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  // Filter alerts to accessible committees for non-global users
  const visibleAlerts = canViewAllCommittees(auth.user.role)
    ? alerts
    : alerts.filter((a) => canAccessCommittee(auth.user, a.committeeId));

  return NextResponse.json({ stats, alerts: visibleAlerts });
}
