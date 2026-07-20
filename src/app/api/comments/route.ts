import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/lib/types";

const COMMENT_ENTITY_TYPES: EntityType[] = [
  "ASSIGNMENT",
  "PROJECT",
  "TASK",
  "REPORT",
  "LIBRARY_DOCUMENT",
  "DOCUMENT",
];

function parseEntityType(value: string | null | undefined): EntityType | null {
  if (!value) return null;
  return COMMENT_ENTITY_TYPES.includes(value as EntityType)
    ? (value as EntityType)
    : null;
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const entityType = parseEntityType(searchParams.get("entityType"));
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: "entityType and entityId required (supports LIBRARY_DOCUMENT, DOCUMENT, etc.)" },
      { status: 400 },
    );
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
    entityType?: string;
    entityId?: string;
  };

  const entityType = parseEntityType(body.entityType);

  if (!body.body?.trim() || !entityType || !body.entityId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: {
      body: body.body.trim(),
      authorId: auth.user.id,
      entityType,
      entityId: body.entityId,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  await logActivity({
    entityType,
    entityId: body.entityId,
    action: "COMMENT_ADDED",
    actorId: auth.user.id,
  });

  return NextResponse.json(comment, { status: 201 });
}
