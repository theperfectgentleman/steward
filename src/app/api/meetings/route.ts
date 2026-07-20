import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canApproveMinutes,
  canLogMinutes,
  canViewAllCommittees,
} from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const eventId = searchParams.get("eventId");

  if (eventId) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    if (event.committeeId) {
      const access = assertCommitteeAccess(auth.user, event.committeeId);
      if (access) return access;
    } else if (!canViewAllCommittees(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const meeting = await prisma.meeting.findUnique({
      where: { eventId },
      include: {
        committee: { select: { name: true } },
        minutes: { orderBy: { order: "asc" } },
        attendances: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    return NextResponse.json(meeting ? [meeting] : []);
  }

  if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  } else if (!canViewAllCommittees(perm)) {
    return NextResponse.json({ error: "committeeId required" }, { status: 400 });
  }

  const meetings = await prisma.meeting.findMany({
    where: committeeId
      ? { committeeId }
      : canViewAllCommittees(perm)
        ? undefined
        : {
            committeeId: {
              in: auth.user.committeeMemberships.map((m) => m.committeeId),
            },
          },
    include: {
      committee: { select: { name: true } },
      minutes: { orderBy: { order: "asc" } },
      attendances: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(meetings);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    title?: string;
    date?: string;
    committeeId?: string;
    eventId?: string;
    points?: string[];
    memberIds?: string[];
  };

  if (!body.title || !body.date || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const mutation = assertCommitteeMutation(auth.user, body.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canLogMinutes(perm, body.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, body.committeeId);
  if (access) return access;

  let memberIds = body.memberIds ?? [];
  if (memberIds.length === 0) {
    const roster = await prisma.committeeMember.findMany({
      where: { committeeId: body.committeeId },
      select: { userId: true },
    });
    memberIds = roster.map((m) => m.userId);
  }

  const meeting = await prisma.meeting.create({
    data: {
      title: body.title,
      date: new Date(body.date),
      committeeId: body.committeeId,
      eventId: body.eventId || null,
      createdById: auth.user.id,
      minutes: {
        create: (body.points ?? []).map((content, i) => ({
          content,
          order: i + 1,
        })),
      },
      attendances: {
        create: memberIds.map((userId) => ({
          userId,
          status: "UNMARKED",
        })),
      },
    },
    include: {
      minutes: true,
      attendances: { include: { user: true } },
    },
  });

  return NextResponse.json(meeting, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    id?: string;
    approved?: boolean;
    points?: string[];
  };

  if (!body.id) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (body.approved === undefined && body.points === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const existing = await prisma.meeting.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (!existing.committeeId) {
    return NextResponse.json(
      { error: "Meeting is not linked to a committee" },
      { status: 400 },
    );
  }

  const mutation = assertCommitteeMutation(auth.user, existing.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  const access = assertCommitteeAccess(auth.user, existing.committeeId);
  if (access) return access;

  if (body.approved !== undefined) {
    if (!canApproveMinutes(perm, existing.committeeId)) {
      return NextResponse.json(
        { error: "Only the chairperson can approve minutes" },
        { status: 403 },
      );
    }
  }

  if (body.points !== undefined) {
    if (!canLogMinutes(perm, existing.committeeId)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  const meeting = await prisma.$transaction(async (tx) => {
    if (body.points !== undefined) {
      await tx.minutePoint.deleteMany({ where: { meetingId: body.id! } });
      if (body.points.length > 0) {
        await tx.minutePoint.createMany({
          data: body.points.map((content, i) => ({
            meetingId: body.id!,
            content,
            order: i + 1,
          })),
        });
      }
    }

    return tx.meeting.update({
      where: { id: body.id! },
      data: {
        ...(body.approved !== undefined && { approved: body.approved }),
      },
      include: {
        minutes: { orderBy: { order: "asc" } },
        attendances: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
  });

  return NextResponse.json(meeting);
}
