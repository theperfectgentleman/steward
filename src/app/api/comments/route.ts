import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  requireUser,
  requireActiveOrg,
  asPermissionUser,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/lib/types";
import {
  authorizeDocumentAccess,
  loadDocumentForOrg,
} from "@/lib/document-access";

const COMMENT_ENTITY_TYPES: EntityType[] = [
  "TASK",
  "LIBRARY_DOCUMENT",
  "DOCUMENT",
];

function parseEntityType(value: string | null | undefined): EntityType | null {
  if (!value) return null;
  return COMMENT_ENTITY_TYPES.includes(value as EntityType)
    ? (value as EntityType)
    : null;
}

async function assertCommentAccess(
  entityType: EntityType,
  entityId: string,
  requireComment = false,
) {
  if (entityType === "TASK") {
    const auth = await requireUser();
    if (auth.error) {
      return { error: auth.error as NextResponse, user: null, role: null };
    }
    const task = await prisma.task.findUnique({
      where: { id: entityId },
      select: { committeeId: true },
    });
    if (!task) {
      return {
        error: NextResponse.json({ error: "Task not found" }, { status: 404 }),
        user: null,
        role: null,
      };
    }
    const access = assertCommitteeAccess(auth.user, task.committeeId);
    if (access) return { error: access, user: null, role: null };
    return { error: null, user: auth.user, role: null };
  }

  if (entityType !== "LIBRARY_DOCUMENT") {
    const auth = await requireUser();
    if (auth.error) return { error: auth.error as NextResponse, user: null, role: null };
    return { error: null, user: auth.user, role: null };
  }

  const auth = await requireActiveOrg();
  if (auth.error) return { error: auth.error, user: null, role: null };

  const doc = await loadDocumentForOrg(entityId, auth.org.organizationId);
  if (!doc) {
    return {
      error: NextResponse.json({ error: "Document not found" }, { status: 404 }),
      user: null,
      role: null,
    };
  }

  const { role, error } = authorizeDocumentAccess(
    auth.user,
    doc,
    requireComment ? { requireComment: true } : {},
  );
  if (error) return { error, user: null, role: null };
  return { error: null, user: auth.user, role };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityType = parseEntityType(searchParams.get("entityType"));
  const entityId = searchParams.get("entityId");
  const threadId = searchParams.get("threadId");
  const anchoredOnly = searchParams.get("anchored") === "1";

  if (!entityType || !entityId) {
    return NextResponse.json(
      { error: "entityType and entityId required" },
      { status: 400 },
    );
  }

  const access = await assertCommentAccess(entityType, entityId);
  if (access.error) return access.error;

  const comments = await prisma.comment.findMany({
    where: {
      entityType,
      entityId,
      ...(threadId ? { threadId } : {}),
      ...(anchoredOnly ? { anchorMarkId: { not: null } } : {}),
    },
    include: {
      author: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    body?: string;
    entityType?: string;
    entityId?: string;
    threadId?: string;
    parentId?: string;
    anchorMarkId?: string;
    anchorText?: string;
  };

  const entityType = parseEntityType(body.entityType);

  if (!body.body?.trim() || !entityType || !body.entityId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const access = await assertCommentAccess(entityType, body.entityId, true);
  if (access.error) return access.error;
  if (!access.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Block ORG_TECH
  const perm = asPermissionUser(access.user);
  if (perm.role === "ORG_TECH") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const comment = await prisma.comment.create({
    data: {
      body: body.body.trim(),
      authorId: access.user.id,
      entityType,
      entityId: body.entityId,
      threadId: body.threadId || null,
      parentId: body.parentId || null,
      anchorMarkId: body.anchorMarkId || null,
      anchorText: body.anchorText || null,
    },
    include: {
      author: { select: { id: true, name: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
  });

  // Root anchored thread: set threadId = id and align mark id
  let result = comment;
  if (body.anchorMarkId && !body.threadId && !body.parentId) {
    result = await prisma.comment.update({
      where: { id: comment.id },
      data: { threadId: comment.id, anchorMarkId: comment.id },
      include: {
        author: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });
  } else if (body.threadId && !comment.threadId) {
    result = await prisma.comment.update({
      where: { id: comment.id },
      data: { threadId: body.threadId },
      include: {
        author: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });
  }

  await logActivity({
    entityType,
    entityId: body.entityId,
    action: "COMMENT_ADDED",
    actorId: access.user.id,
    metadata: {
      anchorMarkId: body.anchorMarkId ?? null,
      threadId: result.threadId,
    },
  });

  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    id?: string;
    resolve?: boolean;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.comment.findUnique({ where: { id: body.id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (
    existing.entityType === "LIBRARY_DOCUMENT" ||
    existing.entityType === "TASK"
  ) {
    const access = await assertCommentAccess(
      existing.entityType,
      existing.entityId,
      true,
    );
    if (access.error) return access.error;
  }

  if (body.resolve === true) {
    const threadId = existing.threadId || existing.id;
    await prisma.comment.updateMany({
      where: {
        OR: [{ id: threadId }, { threadId }],
        entityType: existing.entityType,
        entityId: existing.entityId,
      },
      data: {
        resolvedAt: new Date(),
        resolvedById: auth.user.id,
      },
    });

    const updated = await prisma.comment.findUnique({
      where: { id: existing.id },
      include: {
        author: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    await logActivity({
      entityType: existing.entityType,
      entityId: existing.entityId,
      action: "COMMENT_RESOLVED",
      actorId: auth.user.id,
      metadata: { threadId },
    });

    return NextResponse.json(updated);
  }

  if (body.resolve === false) {
    const threadId = existing.threadId || existing.id;
    await prisma.comment.updateMany({
      where: {
        OR: [{ id: threadId }, { threadId }],
        entityType: existing.entityType,
        entityId: existing.entityId,
      },
      data: { resolvedAt: null, resolvedById: null },
    });
    const updated = await prisma.comment.findUnique({
      where: { id: existing.id },
      include: {
        author: { select: { id: true, name: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}
