import { NextResponse } from "next/server";
import { asPermissionUser, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllCommittees } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const perm = asPermissionUser(auth.user);
  const committeeIds = auth.user.committeeMemberships.map((m) => m.committeeId);
  const global = canViewAllCommittees(perm);

  const [assignments, projects, tasks, users] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        title: { contains: q, mode: "insensitive" },
        ...(global
          ? {}
          : {
              OR: [
                { targetCommitteeId: { in: committeeIds } },
                { createdById: auth.user.id },
              ],
            }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        targetCommittee: { select: { name: true } },
      },
      take: 10,
    }),
    prisma.project.findMany({
      where: {
        title: { contains: q, mode: "insensitive" },
        ...(global ? {} : { committeeId: { in: committeeIds } }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        committeeId: true,
        committee: { select: { name: true } },
      },
      take: 10,
    }),
    prisma.task.findMany({
      where: {
        title: { contains: q, mode: "insensitive" },
        ...(global ? {} : { committeeId: { in: committeeIds } }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        committeeId: true,
        committee: { select: { name: true } },
      },
      take: 10,
    }),
    prisma.user.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        ...(global
          ? {}
          : {
              committeeMemberships: {
                some: { committeeId: { in: committeeIds } },
              },
            }),
      },
      select: { id: true, name: true, role: true },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    assignments: assignments.map((a) => ({
      ...a,
      href: `/assignments/${a.id}`,
    })),
    projects: projects.map((p) => ({
      ...p,
      href: `/c/${p.committeeId}/projects/${p.id}`,
    })),
    tasks: tasks.map((t) => ({
      ...t,
      href: `/c/${t.committeeId}/tasks?task=${t.id}`,
    })),
    users,
  });
}
