import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { ensureMeetingForEvent } from "@/lib/meeting-for-event";
import { prisma } from "@/lib/prisma";
import { canLogMinutes } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event?.committeeId) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const mutation = assertCommitteeMutation(auth.user, event.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canLogMinutes(perm, event.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId);
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
