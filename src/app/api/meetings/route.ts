import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");

  const meetings = await prisma.meeting.findMany({
    where: committeeId ? { committeeId } : undefined,
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
  const body = (await request.json()) as {
    title?: string;
    date?: string;
    committeeId?: string;
    createdById?: string;
    points?: string[];
    memberIds?: string[];
  };

  if (!body.title || !body.date || !body.committeeId || !body.createdById) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const meeting = await prisma.meeting.create({
    data: {
      title: body.title,
      date: new Date(body.date),
      committeeId: body.committeeId,
      createdById: body.createdById,
      minutes: {
        create: (body.points ?? []).map((content, i) => ({
          content,
          order: i + 1,
        })),
      },
      attendances: {
        create: (body.memberIds ?? []).map((userId) => ({
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
