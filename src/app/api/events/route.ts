import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const global = searchParams.get("global") === "true";

  const events = await prisma.event.findMany({
    where: global ? undefined : committeeId ? { committeeId } : undefined,
    include: {
      committee: { select: { name: true, charterLetter: true } },
      rsvps: { include: { user: { select: { name: true } } } },
    },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    startDate?: string;
    committeeId?: string;
  };

  if (!body.title || !body.startDate || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: {
      title: body.title,
      description: body.description,
      startDate: new Date(body.startDate),
      committeeId: body.committeeId,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
