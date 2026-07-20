import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTasks } from "@/lib/types";

async function loadEvent(eventId: string) {
  return prisma.event.findUnique({ where: { id: eventId } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const event = await loadEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.committeeId) {
    return NextResponse.json(
      { error: "Event is not linked to a committee" },
      { status: 400 },
    );
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId);
  if (access) return access;

  const items = await prisma.agendaItem.findMany({
    where: { eventId },
    orderBy: { order: "asc" },
    include: {
      assignment: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(items);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const event = await loadEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.committeeId) {
    return NextResponse.json(
      { error: "Event is not linked to a committee" },
      { status: 400 },
    );
  }

  const mutation = assertCommitteeMutation(auth.user, event.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, event.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId);
  if (access) return access;

  const body = (await request.json()) as {
    title?: string;
    assignmentId?: string | null;
    order?: number;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  let order = body.order;
  if (order === undefined) {
    const last = await prisma.agendaItem.findFirst({
      where: { eventId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    order = (last?.order ?? 0) + 1;
  }

  const item = await prisma.agendaItem.create({
    data: {
      eventId,
      title: body.title.trim(),
      assignmentId: body.assignmentId || null,
      order,
    },
    include: {
      assignment: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const event = await loadEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }
  if (!event.committeeId) {
    return NextResponse.json(
      { error: "Event is not linked to a committee" },
      { status: 400 },
    );
  }

  const mutation = assertCommitteeMutation(auth.user, event.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, event.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId);
  if (access) return access;

  const { searchParams } = new URL(request.url);
  const agendaItemId = searchParams.get("agendaItemId");
  if (!agendaItemId) {
    return NextResponse.json(
      { error: "agendaItemId required" },
      { status: 400 },
    );
  }

  const item = await prisma.agendaItem.findFirst({
    where: { id: agendaItemId, eventId },
  });
  if (!item) {
    return NextResponse.json({ error: "Agenda item not found" }, { status: 404 });
  }

  await prisma.agendaItem.delete({ where: { id: agendaItemId } });
  return NextResponse.json({ ok: true });
}
