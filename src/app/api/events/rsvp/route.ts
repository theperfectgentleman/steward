import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    eventId?: string;
    userId?: string;
    status?: "GOING" | "DECLINED" | "PENDING";
  };

  if (!body.eventId || !body.userId || !body.status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const rsvp = await prisma.eventRsvp.upsert({
    where: {
      eventId_userId: { eventId: body.eventId, userId: body.userId },
    },
    create: {
      eventId: body.eventId,
      userId: body.userId,
      status: body.status,
    },
    update: { status: body.status },
  });

  return NextResponse.json(rsvp);
}
