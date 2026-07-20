import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { enrichEventsWithProgress } from "@/lib/event-queries";
import { prisma } from "@/lib/prisma";
import { canEditTasks, canViewAllCommittees } from "@/lib/types";
import type { ScheduleFormat, ScheduleKind } from "@/lib/types";

const KINDS: ScheduleKind[] = ["MEETING", "EVENT"];
const FORMATS: ScheduleFormat[] = ["IN_PERSON", "VIRTUAL", "HYBRID"];

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const global = searchParams.get("global") === "true";

  if (global) {
    if (!canViewAllCommittees(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  } else {
    return NextResponse.json(
      { error: "committeeId or global=true required" },
      { status: 400 },
    );
  }

  const events = await prisma.event.findMany({
    where: global ? undefined : { committeeId: committeeId! },
    include: {
      committee: { select: { name: true, charterLetter: true } },
      rsvps: {
        include: { user: { select: { id: true, name: true } } },
      },
      meeting: { select: { id: true, approved: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const enriched = await enrichEventsWithProgress(events);
  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string | null;
    committeeId?: string;
    kind?: ScheduleKind;
    format?: ScheduleFormat;
    location?: string | null;
    joinUrl?: string | null;
    agenda?: string | null;
  };

  if (!body.title || !body.startDate || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const kind: ScheduleKind =
    body.kind && KINDS.includes(body.kind) ? body.kind : "EVENT";
  const format: ScheduleFormat =
    body.format && FORMATS.includes(body.format) ? body.format : "IN_PERSON";

  const mutation = assertCommitteeMutation(auth.user, body.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, body.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, body.committeeId);
  if (access) return access;

  const organizationId = auth.user.orgContext?.organizationId ?? null;
  const startDate = new Date(body.startDate);

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        title: body.title!,
        description: body.description,
        startDate,
        endDate: body.endDate ? new Date(body.endDate) : null,
        committeeId: body.committeeId!,
        organizationId,
        kind,
        format,
        location: body.location?.trim() || null,
        joinUrl: body.joinUrl?.trim() || null,
        agenda: body.agenda?.trim() || null,
      },
      include: {
        committee: { select: { name: true, charterLetter: true } },
        rsvps: true,
        meeting: true,
        agendaItems: { orderBy: { order: "asc" } },
      },
    });

    if (kind === "MEETING") {
      const roster = await tx.committeeMember.findMany({
        where: { committeeId: body.committeeId! },
        select: { userId: true },
      });

      await tx.meeting.create({
        data: {
          title: body.title!,
          date: startDate,
          committeeId: body.committeeId!,
          eventId: created.id,
          createdById: auth.user.id,
          attendances: {
            create: roster.map((m) => ({
              userId: m.userId,
              status: "UNMARKED",
            })),
          },
        },
      });

      return tx.event.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          committee: { select: { name: true, charterLetter: true } },
          rsvps: true,
          meeting: true,
          agendaItems: { orderBy: { order: "asc" } },
        },
      });
    }

    return created;
  });

  return NextResponse.json(event, { status: 201 });
}
