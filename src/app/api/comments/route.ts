import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") as EntityType | null;
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
  }

  const comments = await prisma.comment.findMany({
    where: { entityType, entityId },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    body?: string;
    entityType?: EntityType;
    entityId?: string;
  };

  if (!body.body?.trim() || !body.entityType || !body.entityId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      body: body.body.trim(),
      authorId: auth.user.id,
      entityType: body.entityType,
      entityId: body.entityId,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  await logActivity({
    entityType: body.entityType,
    entityId: body.entityId,
    action: "COMMENT_ADDED",
    actorId: auth.user.id,
  });

  return NextResponse.json(comment, { status: 201 });
}
