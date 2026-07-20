import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import {
  asPermissionUser,
  assertCommitteeAccess,
  requireActiveOrg,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LIBRARY_DOCUMENT_TAGS, type LibraryDocumentTag } from "@/lib/documents";
import { canReadDocuments, canViewAllCommittees } from "@/lib/types";

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

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const tag = searchParams.get("tag");
  const orgId = auth.org.organizationId;

  if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  }

  const where: Prisma.LibraryDocumentWhereInput = {
    OR: [{ organizationId: orgId }, { organizationId: null }],
  };

  if (tag && LIBRARY_DOCUMENT_TAGS.includes(tag as LibraryDocumentTag)) {
    where.tag = tag as LibraryDocumentTag;
  }

  if (committeeId) {
    where.committeeId = committeeId;
  } else if (!canViewAllCommittees(perm)) {
    const ids = auth.user.committeeMemberships.map((m) => m.committeeId);
    where.AND = [
      {
        OR: [{ committeeId: { in: ids } }, { committeeId: null }],
      },
    ];
  }

  const documents = await prisma.libraryDocument.findMany({
    where,
    include: {
      committee: { select: { id: true, name: true, charterLetter: true } },
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(documents);
}

export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const body = (await request.json()) as {
    title?: string;
    tag?: LibraryDocumentTag;
    source?: "UPLOAD" | "CREATED";
    body?: string;
    fileName?: string;
    fileUrl?: string;
    mimeType?: string;
    committeeId?: string | null;
  };

  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const committeeId = body.committeeId ?? null;
  if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  }

  if (!canManageLibraryDocuments(perm, committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const source = body.source === "UPLOAD" ? "UPLOAD" : "CREATED";
  if (source === "CREATED" && !body.body?.trim()) {
    return NextResponse.json({ error: "Body required for created documents" }, { status: 400 });
  }
  if (source === "UPLOAD" && !body.fileUrl?.trim() && !body.fileName?.trim()) {
    return NextResponse.json(
      { error: "File name or URL required for attachments" },
      { status: 400 },
    );
  }

  const tag =
    body.tag && LIBRARY_DOCUMENT_TAGS.includes(body.tag) ? body.tag : "OTHER";

  const doc = await prisma.libraryDocument.create({
    data: {
      organizationId: auth.org.organizationId,
      title: body.title.trim(),
      tag,
      source,
      body: source === "CREATED" ? body.body?.trim() : null,
      fileName: body.fileName?.trim() || null,
      fileUrl: body.fileUrl?.trim() || null,
      mimeType: body.mimeType?.trim() || null,
      committeeId,
      uploadedById: auth.user.id,
    },
    include: {
      committee: { select: { id: true, name: true, charterLetter: true } },
      uploadedBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
