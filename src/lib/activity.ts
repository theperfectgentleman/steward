import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/lib/types";
import type { Prisma } from "@/generated/prisma";

export async function logActivity(params: {
  entityType: EntityType;
  entityId: string;
  action: string;
  actorId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.activityLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actorId: params.actorId,
      metadata: params.metadata,
    },
  });
}
