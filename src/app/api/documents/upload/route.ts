import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import {
  asPermissionUser,
  assertCommitteeAccess,
  requireActiveOrg,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import { LIBRARY_DOCUMENT_TAGS, type LibraryDocumentTag } from "@/lib/documents";
import {
  createDocumentMembers,
  resolveDefaultApproverIds,
} from "@/lib/document-access";
import { buildR2Key, isR2Configured, putR2Object, sanitizeStorageFileName } from "@/lib/r2";
import { canReadDocuments, canManageTor } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

function canManageLibraryDocuments(
  perm: ReturnType<typeof asPermissionUser>,
  committeeId?: string | null,
) {
  if (perm.role === "ORG_TECH") return false;
  if (perm.role === "ORG_ADMIN" || perm.role === "ORG_PARTICIPANT") {
    return true;
  }
  if (!committeeId) return false;
  return canReadDocuments(perm, committeeId);
}

export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "File storage is not configured on this server" },
      { status: 503 },
    );
  }

  const perm = asPermissionUser(auth.user);
  if (perm.role === "ORG_TECH") {
    return NextResponse.json(
      { error: "System admins cannot manage documents" },
      { status: 403 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const titleInput = (formData.get("title") as string | null)?.trim();
    const tagInput = (formData.get("tag") as string | null) as LibraryDocumentTag | null;
    const committeeId = (formData.get("committeeId") as string | null) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 25 MB)" },
        { status: 400 },
      );
    }

    if (committeeId) {
      const access = assertCommitteeAccess(auth.user, committeeId);
      if (access) return access;
    }

    if (!canManageLibraryDocuments(perm, committeeId)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const title = titleInput || file.name.replace(/\.[^/.]+$/, "") || file.name;
    const tag: LibraryDocumentTag =
      tagInput && LIBRARY_DOCUMENT_TAGS.includes(tagInput) ? tagInput : "OTHER";

    if (tag === "TOR") {
      if (!committeeId) {
        return NextResponse.json(
          { error: "TOR must belong to a committee" },
          { status: 400 },
        );
      }
      if (!canManageTor(perm, committeeId)) {
        return NextResponse.json(
          { error: "Only the committee chair can add a TOR" },
          { status: 403 },
        );
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = sanitizeStorageFileName(file.name);
    const mimeType = file.type || "application/octet-stream";

    const doc = await prisma.libraryDocument.create({
      data: {
        organizationId: auth.org.organizationId,
        title,
        tag,
        source: "UPLOAD",
        kind: "DOCUMENT",
        status: "DRAFT",
        fileName: file.name,
        mimeType,
        committeeId,
        uploadedById: auth.user.id,
      },
    });

    const storageKey = buildR2Key(
      "orgs",
      auth.org.organizationId,
      "library",
      doc.id,
      safeName,
    );

    await putR2Object({
      key: storageKey,
      body: buffer,
      contentType: mimeType,
    });

    const updated = await prisma.libraryDocument.update({
      where: { id: doc.id },
      data: { storageKey },
      include: {
        committee: { select: { id: true, name: true, charterLetter: true } },
        uploadedBy: { select: { id: true, name: true } },
        members: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    const approvers = await resolveDefaultApproverIds({
      organizationId: auth.org.organizationId,
      committeeId,
      tag,
    });
    await createDocumentMembers({
      documentId: doc.id,
      ownerId: auth.user.id,
      approvers,
    });

    await logActivity({
      entityType: "LIBRARY_DOCUMENT",
      entityId: doc.id,
      action: "DOCUMENT_UPLOADED",
      actorId: auth.user.id,
      metadata: { title, tag, storageKey } as Prisma.InputJsonValue,
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (err: unknown) {
    console.error("Document upload error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to upload document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
