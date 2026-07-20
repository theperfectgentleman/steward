import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { requireEventCommitteeId } from "@/lib/event-access";
import { getEventWithProgress } from "@/lib/event-queries";
import { prisma } from "@/lib/prisma";
import { canEditTasks } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const missing = requireEventCommitteeId(event.committeeId);
  if (missing) return missing;

  const mutation = assertCommitteeMutation(auth.user, event.committeeId!);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, event.committeeId!)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId!);
  if (access) return access;

  const body = (await request.json()) as {
    tasks?: { title: string; description?: string; assignedToId?: string }[];
  };

  if (!body.tasks?.length) {
    return NextResponse.json({ error: "No tasks provided" }, { status: 400 });
  }

  await prisma.task.createMany({
    data: body.tasks.map((t) => ({
      title: t.title.trim(),
      description: t.description?.trim() || null,
      committeeId: event.committeeId!,
      eventId,
      assignedToId: t.assignedToId || null,
      createdById: auth.user.id,
    })),
  });

  const updated = await getEventWithProgress(eventId);
  return NextResponse.json(updated, { status: 201 });
}
