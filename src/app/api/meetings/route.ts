import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertNotReadOnly,
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

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");

  if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  } else if (!canViewAllCommittees(auth.user.role)) {
    return NextResponse.json({ error: "committeeId required" }, { status: 400 });
  }

  const meetings = await prisma.meeting.findMany({
    where: committeeId
      ? { committeeId }
      : canViewAllCommittees(auth.user.role)
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

  const readOnly = assertNotReadOnly(auth.user);
  if (readOnly) return readOnly;

  if (!canLogMinutes(auth.user.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    date?: string;
    committeeId?: string;
    points?: string[];
    memberIds?: string[];
  };

  if (!body.title || !body.date || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const access = assertCommitteeAccess(auth.user, body.committeeId);
  if (access) return access;

  // Prefer explicit memberIds; otherwise bootstrap from committee roster
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

  const readOnly = assertNotReadOnly(auth.user);
  if (readOnly) return readOnly;

  if (!canApproveMinutes(auth.user.role)) {
    return NextResponse.json(
      { error: "Only the chairperson can approve minutes" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    id?: string;
    approved?: boolean;
  };

  if (!body.id || body.approved === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const existing = await prisma.meeting.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  const access = assertCommitteeAccess(auth.user, existing.committeeId);
  if (access) return access;

  const meeting = await prisma.meeting.update({
    where: { id: body.id },
    data: { approved: body.approved },
    include: {
      minutes: { orderBy: { order: "asc" } },
      attendances: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(meeting);
}
