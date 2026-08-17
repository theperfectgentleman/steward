import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { assertEventOrgMutation, requireEventCommitteeId } from "@/lib/event-access";
import { getEventWithProgress } from "@/lib/event-queries";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const orgId = auth.org.organizationId;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const missing = requireEventCommitteeId(event.committeeId);
  if (missing) return missing;

  const mutation = assertEventOrgMutation(auth.user, event, orgId);
  if (mutation) return mutation;

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
      organizationId: orgId,
      committeeId: event.committeeId!,
      eventId,
      assignedToId: t.assignedToId || null,
      createdById: auth.user.id,
    })),
  });

  const updated = await getEventWithProgress(eventId, orgId);
  return NextResponse.json(updated, { status: 201 });
}
