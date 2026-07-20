import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { getEventWithProgress } from "@/lib/event-queries";
import { prisma } from "@/lib/prisma";
import { canEditTasks } from "@/lib/types";
import type { ScheduleFormat, ScheduleKind } from "@/lib/types";

const KINDS: ScheduleKind[] = ["MEETING", "EVENT"];
const FORMATS: ScheduleFormat[] = ["IN_PERSON", "VIRTUAL", "HYBRID"];

function requireCommitteeId(committeeId: string | null) {
  if (!committeeId) {
    return NextResponse.json(
      { error: "Event is not linked to a committee" },
      { status: 400 },
    );
  }
  return null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const event = await getEventWithProgress(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const missing = requireCommitteeId(event.committeeId);
  if (missing) return missing;

  const access = assertCommitteeAccess(auth.user, event.committeeId!);
  if (access) return access;

  return NextResponse.json(event);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const missing = requireCommitteeId(existing.committeeId);
  if (missing) return missing;

  const mutation = assertCommitteeMutation(auth.user, existing.committeeId!);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, existing.committeeId!)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, existing.committeeId!);
  if (access) return access;

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
    }
  });

  const event = await getEventWithProgress(id);
  return NextResponse.json(event);
}
