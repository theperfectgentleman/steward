import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");

  const goals = await prisma.timelineGoal.findMany({
    where: committeeId ? { committeeId } : undefined,
    include: { committee: { select: { name: true, charterLetter: true } } },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(goals);
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    id?: string;
    progress?: number;
    startDate?: string;
    endDate?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const goal = await prisma.timelineGoal.update({
    where: { id: body.id },
    data: {
      ...(body.progress !== undefined && { progress: body.progress }),
      ...(body.startDate && { startDate: new Date(body.startDate) }),
      ...(body.endDate && { endDate: new Date(body.endDate) }),
    },
  });

  return NextResponse.json(goal);
}
