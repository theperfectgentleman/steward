import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  defaultLinkRelation,
  isLinkRelation,
  type LinkRelation,
} from "@/lib/domain-vocab";
import { prisma } from "@/lib/prisma";
import {
  authorizeDocumentAccess,
  canEditDocument,
  loadDocumentForOrg,
  memberRoleForUser,
} from "@/lib/document-access";
import type { EntityType } from "@/lib/types";

const LINK_TYPES: EntityType[] = ["TASK", "LIBRARY_DOCUMENT"];

function resolveRelation(
  entityType: EntityType | "EVENT",
  requested: unknown,
): LinkRelation {
  if (isLinkRelation(requested)) return requested;
  return defaultLinkRelation(entityType);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await loadDocumentForOrg(id, auth.org.organizationId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = authorizeDocumentAccess(auth.user, doc);
  if (error) return error;

  const [outgoing, incoming] = await Promise.all([
    prisma.documentLink.findMany({
      where: { documentId: id },
      include: { createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.documentLink.findMany({
      where: { entityType: "LIBRARY_DOCUMENT", entityId: id },
      include: {
        createdBy: { select: { id: true, name: true } },
        document: { select: { id: true, title: true, tag: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const taskIds = outgoing
    .filter((l) => l.entityType === "TASK")
    .map((l) => l.entityId);
  const tasks =
    taskIds.length > 0
      ? await prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, title: true },
        })
      : [];
  const taskMap = new Map(tasks.map((t) => [t.id, t.title]));

  const eventIds = outgoing
    .filter(
      (l) =>
        l.entityType === "DOCUMENT" && l.entityId.startsWith("event:"),
    )
    .map((l) => l.entityId.replace(/^event:/, ""));
  const events =
    eventIds.length > 0
      ? await prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, title: true },
        })
      : [];
  const eventMap = new Map(events.map((e) => [e.id, e.title]));

  const relatedDocIds = outgoing
    .filter((l) => l.entityType === "LIBRARY_DOCUMENT")
    .map((l) => l.entityId);
  const relatedDocs =
    relatedDocIds.length > 0
      ? await prisma.libraryDocument.findMany({
          where: {
            id: { in: relatedDocIds },
            archivedAt: null,
            OR: [
              { organizationId: auth.org.organizationId },
              { organizationId: null },
            ],
          },
          select: { id: true, title: true, tag: true, status: true },
        })
      : [];
  const relatedDocMap = new Map(relatedDocs.map((d) => [d.id, d]));

  const outgoingMapped = outgoing.map((l) => {
    const isEvent =
      l.entityType === "DOCUMENT" && l.entityId.startsWith("event:");
    const eventId = isEvent ? l.entityId.replace(/^event:/, "") : null;
    const related = relatedDocMap.get(l.entityId);
    return {
      ...l,
      direction: "outgoing" as const,
      linkKind: isEvent
        ? "EVENT"
        : l.entityType === "LIBRARY_DOCUMENT"
          ? "LIBRARY_DOCUMENT"
          : l.entityType,
      eventId,
      href:
        l.entityType === "LIBRARY_DOCUMENT"
          ? `/documents/${l.entityId}`
          : null,
      title: isEvent
        ? eventMap.get(eventId!) ?? null
        : l.entityType === "TASK"
          ? taskMap.get(l.entityId) ?? null
          : l.entityType === "LIBRARY_DOCUMENT"
            ? related?.title ?? null
            : null,
      tag: related?.tag ?? null,
      status: related?.status ?? null,
    };
  });

  const incomingMapped = incoming.map((l) => ({
    ...l,
    direction: "incoming" as const,
    linkKind: "LIBRARY_DOCUMENT" as const,
    eventId: null,
    href: `/documents/${l.documentId}`,
    title: l.document.title,
    tag: l.document.tag,
    status: l.document.status,
    // Present as if this doc is looking at the other document
    entityType: "LIBRARY_DOCUMENT" as const,
    entityId: l.documentId,
  }));

  return NextResponse.json([...outgoingMapped, ...incomingMapped]);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await loadDocumentForOrg(id, auth.org.organizationId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { role, error } = authorizeDocumentAccess(auth.user, doc);
  if (error) return error;
  if (!canEditDocument(role)) {
    return NextResponse.json(
      { error: "Editors only can manage links" },
      { status: 403 },
    );
  }

  const body = (await request.json()) as {
    entityType?: string;
    entityId?: string;
    relation?: string;
  };

  // EVENT soft-links: EntityType has TASK | LIBRARY_DOCUMENT | DOCUMENT only.
  // Store as DOCUMENT + entityId `event:{id}` with relation ABOUT by default.
  let entityType = body.entityType as EntityType | "EVENT" | undefined;
  let storedType: EntityType = "TASK";

  if (entityType === "EVENT") {
    storedType = "DOCUMENT";
  } else if (entityType && LINK_TYPES.includes(entityType as EntityType)) {
    storedType = entityType as EntityType;
  } else if (entityType === "TASK") {
    storedType = "TASK";
  } else {
    return NextResponse.json(
      { error: "entityType must be TASK, EVENT, or LIBRARY_DOCUMENT" },
      { status: 400 },
    );
  }

  if (!body.entityId?.trim()) {
    return NextResponse.json({ error: "entityId required" }, { status: 400 });
  }

  const entityId = body.entityId.trim();
  const relation = resolveRelation(
    entityType === "EVENT" ? "EVENT" : storedType,
    body.relation,
  );

  if (storedType === "LIBRARY_DOCUMENT") {
    if (entityId === id) {
      return NextResponse.json(
        { error: "Cannot link a document to itself" },
        { status: 400 },
      );
    }
    const target = await loadDocumentForOrg(entityId, auth.org.organizationId);
    if (!target) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    const targetAccess = authorizeDocumentAccess(auth.user, target);
    if (targetAccess.error) {
      return NextResponse.json(
        { error: "Not authorized to link that document" },
        { status: 403 },
      );
    }

    const link = await prisma.documentLink.upsert({
      where: {
        documentId_entityType_entityId: {
          documentId: id,
          entityType: "LIBRARY_DOCUMENT",
          entityId,
        },
      },
      create: {
        documentId: id,
        entityType: "LIBRARY_DOCUMENT",
        entityId,
        relation,
        createdById: auth.user.id,
      },
      update: { relation },
    });

    await logActivity({
      entityType: "LIBRARY_DOCUMENT",
      entityId: id,
      action: "DOCUMENT_LINKED",
      actorId: auth.user.id,
      metadata: {
        entityType: "LIBRARY_DOCUMENT",
        entityId,
        relation,
      },
    });

    return NextResponse.json(
      {
        ...link,
        direction: "outgoing",
        linkKind: "LIBRARY_DOCUMENT",
        href: `/documents/${entityId}`,
        title: target.title,
        tag: target.tag,
        status: target.status,
      },
      { status: 201 },
    );
  }

  if (storedType === "TASK" || entityType === "TASK") {
    const task = await prisma.task.findFirst({
      where: {
        id: entityId,
        committee: { organizationId: auth.org.organizationId },
      },
    });
    if (!task) {
      const anyTask = await prisma.task.findFirst({
        where: { id: entityId },
      });
      if (!anyTask) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }
    }
    storedType = "TASK";
  }

  if (entityType === "EVENT") {
    const event = await prisma.event.findFirst({
      where: {
        id: entityId,
        OR: [
          { organizationId: auth.org.organizationId },
          { committee: { organizationId: auth.org.organizationId } },
        ],
      },
    });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const link = await prisma.documentLink.upsert({
      where: {
        documentId_entityType_entityId: {
          documentId: id,
          entityType: "DOCUMENT",
          entityId: `event:${entityId}`,
        },
      },
      create: {
        documentId: id,
        entityType: "DOCUMENT",
        entityId: `event:${entityId}`,
        relation,
        createdById: auth.user.id,
      },
      update: { relation },
    });

    await logActivity({
      entityType: "LIBRARY_DOCUMENT",
      entityId: id,
      action: "DOCUMENT_LINKED",
      actorId: auth.user.id,
      metadata: {
        entityType: "EVENT",
        entityId,
        relation,
      },
    });

    return NextResponse.json(
      {
        ...link,
        direction: "outgoing",
        linkKind: "EVENT",
        eventId: entityId,
        title: event.title,
      },
      { status: 201 },
    );
  }

  const link = await prisma.documentLink.upsert({
    where: {
      documentId_entityType_entityId: {
        documentId: id,
        entityType: storedType,
        entityId,
      },
    },
    create: {
      documentId: id,
      entityType: storedType,
      entityId,
      relation,
      createdById: auth.user.id,
    },
    update: { relation },
  });

  await logActivity({
    entityType: "LIBRARY_DOCUMENT",
    entityId: id,
    action: "DOCUMENT_LINKED",
    actorId: auth.user.id,
    metadata: {
      entityType: storedType,
      entityId,
      relation,
    },
  });

  return NextResponse.json(
    { ...link, direction: "outgoing", linkKind: storedType },
    { status: 201 },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await loadDocumentForOrg(id, auth.org.organizationId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { role, error } = authorizeDocumentAccess(auth.user, doc);
  if (error) return error;
  if (!canEditDocument(role)) {
    return NextResponse.json(
      { error: "Editors only can manage links" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const linkId = searchParams.get("linkId");
  if (!linkId) {
    return NextResponse.json({ error: "linkId required" }, { status: 400 });
  }

  const existing = await prisma.documentLink.findFirst({
    where: {
      id: linkId,
      OR: [
        { documentId: id },
        { entityType: "LIBRARY_DOCUMENT", entityId: id },
      ],
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  // Incoming links live on the other document — require edit rights there too.
  if (existing.documentId !== id) {
    const other = await loadDocumentForOrg(
      existing.documentId,
      auth.org.organizationId,
    );
    if (!other) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }
    const otherRole = memberRoleForUser(other, auth.user.id);
    const otherAccess = authorizeDocumentAccess(auth.user, other);
    if (otherAccess.error || !canEditDocument(otherAccess.role ?? otherRole)) {
      return NextResponse.json(
        { error: "Editors only can remove this link" },
        { status: 403 },
      );
    }
  }

  await prisma.documentLink.delete({ where: { id: linkId } });

  return NextResponse.json({ ok: true });
}
