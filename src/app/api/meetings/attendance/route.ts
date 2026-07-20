import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canLogMinutes } from "@/lib/types";

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    meetingId?: string;
    userId?: string;
    status?: "PRESENT" | "EXCUSED" | "ABSENT";
  };

  if (!body.meetingId || !body.userId || !body.status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: body.meetingId },
  });
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  if (!meeting.committeeId) {
    return NextResponse.json(
      { error: "Meeting is not linked to a committee" },
      { status: 400 },
    );
  }

  const mutation = assertCommitteeMutation(auth.user, meeting.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canLogMinutes(perm, meeting.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, meeting.committeeId);
  if (access) return access;

  const attendance = await prisma.attendance.upsert({
    where: {
      meetingId_userId: { meetingId: body.meetingId, userId: body.userId },
    },
    create: {
      meetingId: body.meetingId,
      userId: body.userId,
      status: body.status,
    },
    update: { status: body.status },
  });

  return NextResponse.json(attendance);
}
