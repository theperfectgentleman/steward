import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AssignmentStatus } from "@/lib/types";

const OPEN_ASSIGNMENT_STATUSES: AssignmentStatus[] = [
  "DRAFT",
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "RETURNED",
  "CHAIR_APPROVED",
];

export async function GET() {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const userId = auth.user.id;
  const orgId = auth.org.organizationId;

  const now = new Date();
  const in14Days = new Date(now);
  in14Days.setDate(in14Days.getDate() + 14);

  const committeeIds = auth.user.committeeMemberships.map((m) => m.committeeId);

  const [tasks, assignments, createdProjects, taskProjects, upcomingEvents] =
    await Promise.all([
      prisma.task.findMany({
        where: {
          assignedToId: userId,
          status: { not: "DONE" },
          committee: { organizationId: orgId },
        },
        include: {
          committee: {
            select: { id: true, name: true, charterLetter: true },
          },
          project: { select: { id: true, title: true } },
          event: { select: { id: true, title: true } },
        },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        take: 50,
      }),
      prisma.assignment.findMany({
        where: {
          status: { in: OPEN_ASSIGNMENT_STATUSES },
          AND: [
            {
              OR: [
                { assigneeUserId: userId },
                { accountableOwnerId: userId },
                { createdById: userId },
              ],
            },
            {
              OR: [
                { targetCommittee: { organizationId: orgId } },
                {
                  AND: [{ targetCommitteeId: null }, { createdById: userId }],
                },
              ],
            },
          ],
        },
        include: {
          targetCommittee: {
            select: { id: true, name: true, charterLetter: true },
          },
          assignee: { select: { id: true, name: true } },
          accountableOwner: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 40,
      }),
      prisma.project.findMany({
        where: {
          createdById: userId,
          committee: { organizationId: orgId },
        },
        include: {
          committee: {
            select: { id: true, name: true, charterLetter: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      prisma.project.findMany({
        where: {
          committee: { organizationId: orgId },
          tasks: { some: { assignedToId: userId } },
        },
        include: {
          committee: {
            select: { id: true, name: true, charterLetter: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      prisma.event.findMany({
        where: {
          startDate: { gte: now, lte: in14Days },
          OR: [
            { organizationId: orgId },
            { committee: { organizationId: orgId } },
          ],
          AND: [
            {
              OR: [
                { rsvps: { some: { userId } } },
                ...(committeeIds.length > 0
                  ? [{ committeeId: { in: committeeIds } }]
                  : []),
              ],
            },
          ],
        },
        include: {
          committee: {
            select: { id: true, name: true, charterLetter: true },
          },
          rsvps: {
            where: { userId },
            select: { status: true },
          },
        },
        orderBy: { startDate: "asc" },
        take: 30,
      }),
    ]);

  const projectMap = new Map<string, (typeof createdProjects)[number]>();
  for (const p of [...createdProjects, ...taskProjects]) {
    projectMap.set(p.id, p);
  }
  const projects = [...projectMap.values()].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return NextResponse.json({
    tasks,
    assignments,
    projects,
    upcoming: upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      kind: e.kind,
      startDate: e.startDate,
      endDate: e.endDate,
      committee: e.committee,
      myRsvp: e.rsvps[0]?.status ?? null,
    })),
  });
}
