import { NextResponse } from "next/server";
import { asPermissionUser, requireActiveOrg } from "@/lib/auth";
import { assertEventOrgAccess } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";
import { canRsvp } from "@/lib/types";

export async function PATCH(request: Request) {
  const auth = await requireActiveOrg();
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

  const orgId = auth.org.organizationId;
  const event = await prisma.event.findFirst({
    where: { id: body.eventId, organizationId: orgId },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const access = assertEventOrgAccess(auth.user, event, orgId);
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
