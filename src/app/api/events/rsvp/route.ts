import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRsvp } from "@/lib/types";

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  if (!canRsvp(perm)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    eventId?: string;
    status?: "GOING" | "DECLINED" | "PENDING";
  };

  if (!body.eventId || !body.status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({ where: { id: body.eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId);
  if (access) return access;

  const rsvp = await prisma.eventRsvp.upsert({
    where: {
      eventId_userId: { eventId: body.eventId, userId: auth.user.id },
    },
    create: {
      eventId: body.eventId,
      userId: auth.user.id,
      status: body.status,
    },
    update: { status: body.status },
  });

  return NextResponse.json(rsvp);
}
