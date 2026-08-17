import { NextResponse } from "next/server";
import { asPermissionUser, requireActiveOrg } from "@/lib/auth";
import { assertEventOrgAccess, assertEventOrgMutation } from "@/lib/event-access";
import { ensureMeetingForEvent } from "@/lib/meeting-for-event";
import { prisma } from "@/lib/prisma";
import { canLogMinutes, canViewAllCommittees } from "@/lib/types";

export async function PATCH(
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

  const perm = asPermissionUser(auth.user);
  const canWrite = event.committeeId
    ? canLogMinutes(perm, event.committeeId)
    : canViewAllCommittees(perm);
  if (!canWrite) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertEventOrgAccess(auth.user, event, orgId);
  if (access) return access;

  const body = (await request.json()) as {
    userId?: string;
    status?: "PRESENT" | "EXCUSED" | "ABSENT";
  };

  if (!body.userId || !body.status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const meeting = await ensureMeetingForEvent(eventId);
  if (!meeting) {
    return NextResponse.json({ error: "Not a meeting event" }, { status: 400 });
  }

  const attendance = await prisma.attendance.upsert({
    where: {
      meetingId_userId: { meetingId: meeting.id, userId: body.userId },
    },
    create: {
      meetingId: meeting.id,
      userId: body.userId,
      status: body.status,
    },
    update: { status: body.status },
  });

  return NextResponse.json(attendance);
}
