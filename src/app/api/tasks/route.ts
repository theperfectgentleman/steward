import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const global = searchParams.get("global") === "true";

  if (global) {
    const tasks = await prisma.task.findMany({
      include: {
        committee: { select: { name: true, charterLetter: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(tasks);
  }

  if (!committeeId) {
    return NextResponse.json({ error: "committeeId required" }, { status: 400 });
  }

  const tasks = await prisma.task.findMany({
    where: { committeeId },
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title?: string;
    description?: string;
    committeeId?: string;
    dueDate?: string;
    createdById?: string;
  };

  if (!body.title || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title: body.title,
      description: body.description,
      committeeId: body.committeeId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      createdById: body.createdById,
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  return NextResponse.json(task, { status: 201 });
}
