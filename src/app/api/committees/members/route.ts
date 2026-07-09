import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    userId?: string;
    committeeId?: string;
    title?: "CHAIR" | "SECRETARY" | "MEMBER";
  };

  if (!body.userId || !body.committeeId || !body.title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const membership = await prisma.committeeMember.upsert({
    where: {
      userId_committeeId: {
        userId: body.userId,
        committeeId: body.committeeId,
      },
    },
    create: {
      userId: body.userId,
      committeeId: body.committeeId,
      title: body.title,
    },
    update: { title: body.title },
  });

  return NextResponse.json(membership);
}
