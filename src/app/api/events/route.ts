import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertNotReadOnly,
  requireUser,
} from "@/lib/auth";
import { enrichEventsWithProgress } from "@/lib/event-queries";
import { prisma } from "@/lib/prisma";
import { canEditTasks, canViewAllCommittees } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const global = searchParams.get("global") === "true";

  if (global) {
    if (!canViewAllCommittees(auth.user.role)) {
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
    },
    orderBy: { startDate: "asc" },
  });

  const enriched = await enrichEventsWithProgress(events);
  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const readOnly = assertNotReadOnly(auth.user);
  if (readOnly) return readOnly;

  if (!canEditTasks(auth.user.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    startDate?: string;
    committeeId?: string;
  };

  if (!body.title || !body.startDate || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const access = assertCommitteeAccess(auth.user, body.committeeId);
  if (access) return access;

  const event = await prisma.event.create({
    data: {
      title: body.title,
      description: body.description,
      startDate: new Date(body.startDate),
      committeeId: body.committeeId,
    },
    include: {
      committee: { select: { name: true, charterLetter: true } },
      rsvps: true,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
