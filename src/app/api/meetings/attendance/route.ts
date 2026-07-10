import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    meetingId?: string;
    userId?: string;
    status?: "PRESENT" | "EXCUSED" | "ABSENT";
  };

  if (!body.meetingId || !body.userId || !body.status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

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
