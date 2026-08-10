import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireActiveOrg,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTasks, canReadDocuments } from "@/lib/types";
import type { EntityType } from "@/generated/prisma/client";

export const ATTACHMENT_ENTITY_TYPES: EntityType[] = [
  "TASK",
  "LIBRARY_DOCUMENT",
];

export async function assertAttachmentRead(
  user: SessionUser,
  entityType: EntityType,
  entityId: string,
) {
  const perm = asPermissionUser(user);

  if (entityType === "TASK") {
    const task = await prisma.task.findUnique({
      where: { id: entityId },
      select: { committeeId: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return assertCommitteeAccess(user, task.committeeId);
  }

  if (entityType === "LIBRARY_DOCUMENT") {
    const auth = await requireActiveOrg();
    if (auth.error) return auth.error;

    const doc = await prisma.libraryDocument.findFirst({
      where: {
        id: entityId,
        OR: [
          { organizationId: auth.org.organizationId },
          { organizationId: null },
        ],
      },
      select: { committeeId: true },
    });
    if (!doc) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (doc.committeeId && !canReadDocuments(perm, doc.committeeId)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    return null;
  }

  return NextResponse.json({ error: "Unsupported entity type" }, { status: 400 });
}

export async function assertAttachmentWrite(
  user: SessionUser,
  entityType: EntityType,
  entityId: string,
) {
  const perm = asPermissionUser(user);

  if (entityType === "TASK") {
    const task = await prisma.task.findUnique({
      where: { id: entityId },
      select: { committeeId: true },
    });
    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const mutation = assertCommitteeMutation(user, task.committeeId);
    if (mutation) return mutation;
    if (!canEditTasks(perm, task.committeeId)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    return null;
  }

  return assertAttachmentRead(user, entityType, entityId);
}
