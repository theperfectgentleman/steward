import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { asPermissionUser, requireActiveOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewAllCommittees } from "@/lib/types";
import { tasksPath } from "@/lib/navigation";

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const perm = asPermissionUser(auth.user);
  const committeeIds = auth.user.committeeMemberships.map((m) => m.committeeId);
  const global = canViewAllCommittees(perm);
  const orgId = auth.org.organizationId;

  const docWhere: Prisma.LibraryDocumentWhereInput = {
    archivedAt: null,
    organizationId: orgId,
    title: { contains: q, mode: "insensitive" },
  };

  if (!global) {
    docWhere.AND = [
      {
        OR: [
          { committeeId: { in: committeeIds } },
          { committeeId: null },
          { members: { some: { userId: auth.user.id } } },
        ],
      },
    ];
  }

  const [tasks, users, documents] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId: orgId,
        title: { contains: q, mode: "insensitive" },
        ...(global
          ? {}
          : {
              OR: [
                { committeeId: { in: committeeIds } },
                { committeeId: null, workClass: "PERSONAL" },
              ],
            }),
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
    prisma.libraryDocument.findMany({
      where: docWhere,
      select: {
        id: true,
        title: true,
        tag: true,
        status: true,
        committee: { select: { name: true } },
      },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      ...t,
      href: tasksPath(t.committeeId, { taskId: t.id }),
    })),
    users,
    documents: documents.map((d) => ({
      ...d,
      href: `/documents/${d.id}`,
    })),
  });
}
