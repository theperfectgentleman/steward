import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireActiveOrg,
} from "@/lib/auth";
import { generateProjectTaskBreakdown } from "@/lib/ai/groq";
import { prisma } from "@/lib/prisma";
import { canEditTasks } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: {
      id,
      committee: { organizationId: auth.org.organizationId },
    },
    include: {
      assignment: { select: { dueDate: true } },
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

  if (!project.description?.trim() && !project.title.trim()) {
    return NextResponse.json(
      { error: "Add a project description before generating tasks" },
      { status: 400 },
    );
  }

  try {
    const dueDate = project.assignment?.dueDate
      ? project.assignment.dueDate.toISOString().slice(0, 10)
      : null;
    const tasks = await generateProjectTaskBreakdown(
      project.title,
      project.description ?? "",
      dueDate,
    );
    return NextResponse.json({ tasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
