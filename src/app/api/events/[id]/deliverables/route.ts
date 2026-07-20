import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { requireEventCommitteeId } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";
import { canEditTasks } from "@/lib/types";

export async function GET(
  _request: Request,
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

  const access = assertCommitteeAccess(auth.user, event.committeeId!);
  if (access) return access;

  const deliverables = await prisma.eventDeliverable.findMany({
    where: { eventId },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(deliverables);
}

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
    title?: string;
    kind?: "NOTE" | "LINK";
    content?: string;
  };

  if (!body.title?.trim() || !body.kind || !body.content?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (body.kind === "LINK") {
    try {
      new URL(body.content);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  const deliverable = await prisma.eventDeliverable.create({
    data: {
      eventId,
      title: body.title.trim(),
      kind: body.kind,
      content: body.content.trim(),
      createdById: auth.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(deliverable, { status: 201 });
}

export async function DELETE(
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

  const { searchParams } = new URL(request.url);
  const deliverableId = searchParams.get("deliverableId");
  if (!deliverableId) {
    return NextResponse.json({ error: "deliverableId required" }, { status: 400 });
  }

  const existing = await prisma.eventDeliverable.findFirst({
    where: { id: deliverableId, eventId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }

  await prisma.eventDeliverable.delete({ where: { id: deliverableId } });
  return NextResponse.json({ ok: true });
}
