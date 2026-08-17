import { NextResponse } from "next/server";
import {
  asPermissionUser,
  requireActiveOrg,
} from "@/lib/auth";
import { assertTaskOrgAccess, assertTaskOrgMutation } from "@/lib/work-context";
import { generateSubtaskDrafts } from "@/lib/ai/groq";
import { prisma } from "@/lib/prisma";
import {
  canEditTasks,
  TASK_WORK_CLASS_LABELS,
  type TaskWorkClass,
} from "@/lib/types";
import { formatDate } from "@/lib/dates";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const orgId = auth.org.organizationId;
  const task = await prisma.task.findFirst({
    where: { id, organizationId: orgId },
    include: {
      subtasks: { select: { title: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const mutation = assertTaskOrgMutation(auth.user, task, orgId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (task.committeeId && !canEditTasks(perm, task.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertTaskOrgAccess(auth.user, task, orgId);
  if (access) return access;

  if (!task.title.trim()) {
    return NextResponse.json(
      { error: "Add a title before suggesting subtasks" },
      { status: 400 },
    );
  }

  const workClass = task.workClass as TaskWorkClass;

  try {
    const drafts = await generateSubtaskDrafts(task.title, task.description, {
      workClassLabel: TASK_WORK_CLASS_LABELS[workClass] ?? workClass,
      existingTitles: task.subtasks.map((s) => s.title),
      dueDate: task.dueDate ? formatDate(task.dueDate) : null,
    });
    return NextResponse.json({ drafts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
