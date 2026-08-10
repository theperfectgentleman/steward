import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireActiveOrg } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import {
  assertDocumentStatusTransition,
  authorizeDocumentAccess,
  getDocumentCapabilities,
  isEditableDocumentStatus,
  loadDocumentForOrg,
  type LibraryDocumentStatus,
} from "@/lib/document-access";
import { LIBRARY_DOCUMENT_STATUSES } from "@/lib/documents";
import { deleteR2Object } from "@/lib/r2";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await loadDocumentForOrg(id, auth.org.organizationId);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.committee && doc.committee.organizationId !== auth.org.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { role, error } = authorizeDocumentAccess(auth.user, doc);
  if (error) return error;

  const caps = getDocumentCapabilities(role, doc.status);

  return NextResponse.json({
    ...doc,
    myRole: role,
    ...caps,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await loadDocumentForOrg(id, auth.org.organizationId);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as {
    title?: string;
    body?: string;
    contentJson?: Record<string, unknown>;
    status?: LibraryDocumentStatus;
    archived?: boolean;
  };

  const isStatusOnly =
    body.status !== undefined &&
    body.title === undefined &&
    body.body === undefined &&
    body.contentJson === undefined &&
    body.archived === undefined;

  const isArchiveOnly =
    body.archived !== undefined &&
    body.title === undefined &&
    body.body === undefined &&
    body.contentJson === undefined &&
    body.status === undefined;

  if (isStatusOnly) {
    const next = body.status!;
    if (!LIBRARY_DOCUMENT_STATUSES.includes(next)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { role, error } = authorizeDocumentAccess(auth.user, doc);
    if (error) return error;

    const transition = assertDocumentStatusTransition(doc.status, next, role);
    if (!transition.ok) {
      return NextResponse.json({ error: transition.error }, { status: 403 });
    }

    const updated = await prisma.libraryDocument.update({
      where: { id },
      data: { status: next },
      include: {
        committee: { select: { id: true, name: true, charterLetter: true } },
        uploadedBy: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    await logActivity({
      entityType: "LIBRARY_DOCUMENT",
      entityId: id,
      action: `DOCUMENT_STATUS_${next}`,
      actorId: auth.user.id,
    });

    const caps = getDocumentCapabilities(role, updated.status);
    return NextResponse.json({ ...updated, myRole: role, ...caps });
  }

  if (isArchiveOnly) {
    const { error } = authorizeDocumentAccess(auth.user, doc, {
      requireManage: true,
    });
    if (error) return error;

    const updated = await prisma.libraryDocument.update({
      where: { id },
      data: { archivedAt: body.archived ? new Date() : null },
    });

    await logActivity({
      entityType: "LIBRARY_DOCUMENT",
      entityId: id,
      action: body.archived ? "DOCUMENT_ARCHIVED" : "DOCUMENT_RESTORED",
      actorId: auth.user.id,
    });

    return NextResponse.json(updated);
  }

  const { role, error } = authorizeDocumentAccess(auth.user, doc, {
    requireEdit: true,
  });
  if (error) return error;

  if (!isEditableDocumentStatus(doc.status)) {
    return NextResponse.json(
      {
        error:
          "Content can only be edited while the document is a draft or returned",
      },
      { status: 403 },
    );
  }

  const updatedData: {
    title?: string;
    body?: string;
    contentJson?: Prisma.InputJsonValue;
  } = {};

  if (typeof body.title === "string" && body.title.trim()) {
    updatedData.title = body.title.trim();
  }
  if (typeof body.body === "string") {
    updatedData.body = body.body;
  }
  if (body.contentJson !== undefined) {
    updatedData.contentJson = body.contentJson as Prisma.InputJsonValue;
  }

  const updatedDoc = await prisma.libraryDocument.update({
    where: { id },
    data: updatedData,
    include: {
      committee: { select: { id: true, name: true, charterLetter: true } },
      uploadedBy: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (body.contentJson) {
    await prisma.documentVersion.create({
      data: {
        documentId: id,
        contentJson: body.contentJson as Prisma.InputJsonValue,
        createdById: auth.user.id,
      },
    });
  }

  await logActivity({
    entityType: "LIBRARY_DOCUMENT",
    entityId: id,
    action: "DOCUMENT_UPDATED",
    actorId: auth.user.id,
  });

  const caps = getDocumentCapabilities(role, updatedDoc.status);
  return NextResponse.json({ ...updatedDoc, myRole: role, ...caps });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await loadDocumentForOrg(id, auth.org.organizationId);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = authorizeDocumentAccess(auth.user, doc, {
    requireManage: true,
  });
  if (error) return error;

  if (doc.storageKey) {
    await deleteR2Object(doc.storageKey);
  }

  await prisma.libraryDocument.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  await logActivity({
    entityType: "LIBRARY_DOCUMENT",
    entityId: id,
    action: "DOCUMENT_ARCHIVED",
    actorId: auth.user.id,
  });

  return NextResponse.json({ ok: true });
}
