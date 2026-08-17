import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { assertEventOrgAccess, assertEventOrgMutation } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
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

  const access = assertEventOrgAccess(auth.user, event, orgId);
  if (access) return access;

  const items = await prisma.agendaItem.findMany({
    where: { eventId },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(items);
}

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

  const mutation = assertEventOrgMutation(auth.user, event, orgId);
  if (mutation) return mutation;

  const body = (await request.json()) as {
    title?: string;
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
      order,
    },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function DELETE(
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

  const mutation = assertEventOrgMutation(auth.user, event, orgId);
  if (mutation) return mutation;

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
