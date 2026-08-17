import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { assertEventOrgAccess, assertEventOrgMutation } from "@/lib/event-access";
import { getEventWithProgress } from "@/lib/event-queries";
import { prisma } from "@/lib/prisma";
import type { ScheduleFormat, ScheduleKind } from "@/lib/types";
import { EVENT_KINDS } from "@/lib/event-kinds";

const KINDS: ScheduleKind[] = EVENT_KINDS;
const FORMATS: ScheduleFormat[] = ["IN_PERSON", "VIRTUAL", "HYBRID"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const orgId = auth.org.organizationId;
  const event = await getEventWithProgress(id, orgId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const access = assertEventOrgAccess(auth.user, event, orgId);
  if (access) return access;

  return NextResponse.json(event);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const orgId = auth.org.organizationId;
  const existing = await prisma.event.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const mutation = assertEventOrgMutation(auth.user, existing, orgId);
  if (mutation) return mutation;

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string | null;
    kind?: ScheduleKind;
    format?: ScheduleFormat;
    location?: string | null;
    joinUrl?: string | null;
    agenda?: string | null;
  };

  const kind =
    body.kind !== undefined && KINDS.includes(body.kind) ? body.kind : undefined;
  const format =
    body.format !== undefined && FORMATS.includes(body.format)
      ? body.format
      : undefined;

  const startDate =
    body.startDate !== undefined ? new Date(body.startDate) : undefined;

  await prisma.$transaction(async (tx) => {
    const nextKind = kind ?? existing.kind;
    await tx.event.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(startDate !== undefined && { startDate }),
        ...(body.endDate !== undefined && {
          endDate: body.endDate ? new Date(body.endDate) : null,
        }),
        ...(kind !== undefined && { kind }),
        ...(format !== undefined && { format }),
        ...(body.location !== undefined && {
          location: body.location?.trim() || null,
        }),
        ...(body.joinUrl !== undefined && {
          joinUrl: body.joinUrl?.trim() || null,
        }),
        ...(body.agenda !== undefined && {
          agenda: body.agenda?.trim() || null,
        }),
      },
    });

    const linked = await tx.meeting.findUnique({ where: { eventId: id } });
    if (linked) {
      await tx.meeting.update({
        where: { id: linked.id },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(startDate !== undefined && { date: startDate }),
        },
      });
    } else if (nextKind === "MEETING") {
      const roster = existing.committeeId
        ? await tx.committeeMember.findMany({
            where: { committeeId: existing.committeeId },
            select: { userId: true },
          })
        : [];
      await tx.meeting.create({
        data: {
          title: body.title ?? existing.title,
          date: startDate ?? existing.startDate,
          committeeId: existing.committeeId,
          eventId: id,
          createdById: auth.user.id,
          attendances: {
            create: roster.map((m) => ({
              userId: m.userId,
              status: "UNMARKED",
            })),
          },
        },
      });
    }
  });

  const event = await getEventWithProgress(id, orgId);
  return NextResponse.json(event);
}
