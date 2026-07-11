import { NextResponse } from "next/server";
import { assertCommitteeAccess, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      committee: { select: { id: true, name: true } },
      assignment: true,
      tasks: {
        include: {
          assignedTo: { select: { id: true, name: true } },
          subtasks: true,
        },
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = assertCommitteeAccess(auth.user, project.committeeId);
  if (access) return access;

  const activity = await prisma.activityLog.findMany({
    where: { entityType: "PROJECT", entityId: id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const comments = await prisma.comment.findMany({
    where: { entityType: "PROJECT", entityId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ project, activity, comments });
}
