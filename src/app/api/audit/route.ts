import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/lib/types";

const ENTITY_TYPES: EntityType[] = [
  "TASK",
  "LIBRARY_DOCUMENT",
  "DOCUMENT",
  "EVENT",
  "INVITE",
  "STRUCTURE",
];

export async function GET(request: Request) {
  const auth = await requireRoles(["ORG_ADMIN", "ORG_TECH"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const actorId = searchParams.get("actorId");
  const entityType = searchParams.get("entityType");
  const limit = Number(searchParams.get("limit") ?? 50);
  const typedEntity = ENTITY_TYPES.includes(entityType as EntityType)
    ? (entityType as EntityType)
    : undefined;

  const logs = await prisma.activityLog.findMany({
    where: {
      organizationId: auth.user.orgContext!.organizationId,
      ...(actorId ? { actorId } : {}),
      ...(typedEntity ? { entityType: typedEntity } : {}),
    },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });

  return NextResponse.json(logs);
}
