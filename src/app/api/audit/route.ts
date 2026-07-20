import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireRoles(["ORG_ADMIN", "ORG_TECH"]);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const actorId = searchParams.get("actorId");
  const entityType = searchParams.get("entityType");
  const limit = Number(searchParams.get("limit") ?? 50);

  const logs = await prisma.activityLog.findMany({
    where: {
      ...(actorId ? { actorId } : {}),
      ...(entityType ? { entityType: entityType as "ASSIGNMENT" | "PROJECT" | "TASK" } : {}),
    },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 200),
  });

  return NextResponse.json(logs);
}
