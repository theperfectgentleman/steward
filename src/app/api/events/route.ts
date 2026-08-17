import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireActiveOrg,
} from "@/lib/auth";
import { enrichEventsWithProgress } from "@/lib/event-queries";
import { prisma } from "@/lib/prisma";
import { canEditTasks, canViewAllCommittees } from "@/lib/types";
import type { ScheduleFormat, ScheduleKind } from "@/lib/types";
import { EVENT_KINDS } from "@/lib/event-kinds";
import { assertCommitteeMatchesOrg } from "@/lib/work-context";

const KINDS: ScheduleKind[] = EVENT_KINDS;
const FORMATS: ScheduleFormat[] = ["IN_PERSON", "VIRTUAL", "HYBRID"];

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const orgId = auth.org.organizationId;
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const global = searchParams.get("global") === "true";
  const mineScope = searchParams.get("scope") === "mine" && !committeeId && !global;

  if (global) {
    if (!canViewAllCommittees(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (mineScope) {
    // user's committees (or all if canViewAll) plus org-wide events
  } else if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  } else {
    return NextResponse.json(
      { error: "committeeId or scope=mine required" },
      { status: 400 },
    );
  }

  const committeeIds =
    mineScope && !canViewAllCommittees(perm)
      ? auth.user.committeeMemberships.map((m) => m.committeeId)
      : undefined;

  const events = await prisma.event.findMany({
    where: {
      organizationId: orgId,
      ...(global
        ? {}
        : mineScope
          ? committeeIds
            ? {
                OR: [
                  { committeeId: { in: committeeIds } },
                  { committeeId: null },
                ],
              }
            : {}
          : { committeeId: committeeId! }),
    },
    include: {
      committee: { select: { id: true, name: true, charterLetter: true } },
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
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const orgId = auth.org.organizationId;
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string | null;
    committeeId?: string | null;
    organizationId?: string | null;
    kind?: ScheduleKind;
    format?: ScheduleFormat;
    location?: string | null;
    joinUrl?: string | null;
    agenda?: string | null;
  };

  if (!body.title || !body.startDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (body.organizationId != null && body.organizationId !== orgId) {
    return NextResponse.json(
      { error: "organizationId must match the active organization" },
      { status: 400 },
    );
  }

  const committeeId = body.committeeId || null;
  const matchErr = await assertCommitteeMatchesOrg(committeeId, orgId);
  if (matchErr) return matchErr;

  const perm = asPermissionUser(auth.user);
  if (committeeId) {
    const mutation = assertCommitteeMutation(auth.user, committeeId);
    if (mutation) return mutation;
    if (!canEditTasks(perm, committeeId)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  } else if (!canViewAllCommittees(perm)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const kind: ScheduleKind =
    body.kind && KINDS.includes(body.kind) ? body.kind : "OTHER";
  const format: ScheduleFormat =
    body.format && FORMATS.includes(body.format) ? body.format : "IN_PERSON";

  const startDate = new Date(body.startDate);

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        title: body.title!,
        description: body.description,
        startDate,
        endDate: body.endDate ? new Date(body.endDate) : null,
        committeeId,
        organizationId: orgId,
        kind,
        format,
        location: body.location?.trim() || null,
        joinUrl: body.joinUrl?.trim() || null,
        agenda: body.agenda?.trim() || null,
      },
      include: {
        committee: { select: { id: true, name: true, charterLetter: true } },
        rsvps: true,
        meeting: true,
        agendaItems: { orderBy: { order: "asc" } },
      },
    });

    if (kind === "MEETING") {
      const roster = committeeId
        ? await tx.committeeMember.findMany({
            where: { committeeId },
            select: { userId: true },
          })
        : [];

      await tx.meeting.create({
        data: {
          title: body.title!,
          date: startDate,
          committeeId,
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
          committee: { select: { id: true, name: true, charterLetter: true } },
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
