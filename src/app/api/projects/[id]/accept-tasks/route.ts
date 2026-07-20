import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireActiveOrg,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { canEditTasks } from "@/lib/types";

type AcceptTask = {
  title: string;
  description?: string;
  estimatedDays?: number;
  dependsOnIndex?: number | null;
  onCriticalPath?: boolean;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id: projectId } = await params;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      committee: { organizationId: auth.org.organizationId },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const mutation = assertCommitteeMutation(auth.user, project.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, project.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, project.committeeId);
  if (access) return access;

  const body = (await request.json()) as { tasks?: AcceptTask[] };
  if (!body.tasks?.length) {
    return NextResponse.json({ error: "No tasks provided" }, { status: 400 });
  }

  const cleaned = body.tasks
    .map((t) => ({
      title: t.title?.trim() ?? "",
      description: t.description?.trim() || null,
      estimatedDays:
        typeof t.estimatedDays === "number" && t.estimatedDays > 0
          ? t.estimatedDays
          : null,
      dependsOnIndex:
        typeof t.dependsOnIndex === "number" &&
        Number.isInteger(t.dependsOnIndex) &&
        t.dependsOnIndex >= 0
          ? t.dependsOnIndex
          : null,
    }))
    .filter((t) => t.title.length > 0);

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "No valid tasks" }, { status: 400 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const t of cleaned) {
        const row = await tx.task.create({
          data: {
            title: t.title,
            description: t.description,
            estimatedDays: t.estimatedDays,
            committeeId: project.committeeId,
            projectId,
            createdById: auth.user.id,
          },
        });
        rows.push(row);
      }

      for (let i = 0; i < cleaned.length; i++) {
        const depIndex = cleaned[i].dependsOnIndex;
        if (depIndex == null) continue;
        if (depIndex >= rows.length || depIndex === i) continue;
        await tx.task.update({
          where: { id: rows[i].id },
          data: { dependsOnTaskId: rows[depIndex].id },
        });
      }

      return rows;
    });

    await logActivity({
      entityType: "PROJECT",
      entityId: projectId,
      action: "TASKS_ACCEPTED",
      actorId: auth.user.id,
      metadata: { count: created.length },
    });

    return NextResponse.json({ tasks: created }, { status: 201 });
  } catch (err) {
    console.error("accept-tasks failed", err);
    return NextResponse.json(
      { error: "Failed to save tasks. Please try again." },
      { status: 500 },
    );
  }
}
