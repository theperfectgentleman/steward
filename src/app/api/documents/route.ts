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
  parseNativeKind,
  resolveDefaultApproverIds,
} from "@/lib/document-access";
import {
  getDocumentTemplateHtml,
  isEmptyDocumentBody,
} from "@/lib/document-templates";
import { canReadDocuments, canViewAllCommittees, canManageTor } from "@/lib/types";

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

const docInclude = {
  committee: { select: { id: true, name: true, charterLetter: true } },
  uploadedBy: { select: { id: true, name: true } },
  members: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.LibraryDocumentInclude;

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const tag = searchParams.get("tag");
  const q = searchParams.get("q")?.trim();
  const orgId = auth.org.organizationId;

  if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  }

  const where: Prisma.LibraryDocumentWhereInput = {
    archivedAt: null,
    OR: [{ organizationId: orgId }, { organizationId: null }],
  };

  if (tag && LIBRARY_DOCUMENT_TAGS.includes(tag as LibraryDocumentTag)) {
    where.tag = tag as LibraryDocumentTag;
  }

  if (q) {
    where.title = { contains: q, mode: "insensitive" };
  }

  if (committeeId) {
    where.committeeId = committeeId;
  } else if (!canViewAllCommittees(perm)) {
    const ids = auth.user.committeeMemberships.map((m) => m.committeeId);
    where.AND = [
      {
        OR: [
          { committeeId: { in: ids } },
          { committeeId: null },
          { members: { some: { userId: auth.user.id } } },
        ],
      },
    ];
  }

  const documents = await prisma.libraryDocument.findMany({
    where,
    include: docInclude,
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
    kind?: string;
    body?: string;
    fileName?: string;
    fileUrl?: string;
    storageKey?: string;
    mimeType?: string;
    committeeId?: string | null;
    editors?: string[];
    reviewers?: string[];
    approvers?: string[];
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

  const tag =
    body.tag && LIBRARY_DOCUMENT_TAGS.includes(body.tag) ? body.tag : "OTHER";

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

  const source = body.source === "UPLOAD" ? "UPLOAD" : "CREATED";
  if (source === "CREATED" && body.body !== undefined && !String(body.body).trim()) {
    // Allow empty starter body — use placeholder
  }
  if (source === "UPLOAD" && !body.fileUrl?.trim() && !body.fileName?.trim() && !body.storageKey?.trim()) {
    return NextResponse.json(
      { error: "File name, URL, or uploaded file required for attachments" },
      { status: 400 },
    );
  }

  const kind = parseNativeKind(body.kind);

  const defaultApprovers = await resolveDefaultApproverIds({
    organizationId: auth.org.organizationId,
    committeeId,
    tag,
  });
  const approvers =
    body.approvers && body.approvers.length > 0 ? body.approvers : defaultApprovers;

  const starterBody =
    source === "CREATED"
      ? isEmptyDocumentBody(body.body)
        ? kind === "DOCUMENT"
          ? getDocumentTemplateHtml(tag)
          : "<p></p>"
        : body.body!.trim()
      : null;

  const doc = await prisma.libraryDocument.create({
    data: {
      organizationId: auth.org.organizationId,
      title: body.title.trim(),
      tag,
      source,
      kind,
      status: "DRAFT",
      body: starterBody,
      contentJson:
        source === "CREATED" && kind === "DOCUMENT"
          ? { html: starterBody }
          : undefined,
      fileName: body.fileName?.trim() || null,
      fileUrl: body.fileUrl?.trim() || null,
      storageKey: body.storageKey?.trim() || null,
      mimeType: body.mimeType?.trim() || null,
      committeeId,
      uploadedById: auth.user.id,
    },
  });

  await createDocumentMembers({
    documentId: doc.id,
    ownerId: auth.user.id,
    editors: body.editors,
    reviewers: body.reviewers,
    approvers,
  });

  await logActivity({
    entityType: "LIBRARY_DOCUMENT",
    entityId: doc.id,
    action: "DOCUMENT_CREATED",
    actorId: auth.user.id,
    metadata: { title: doc.title, kind, tag },
  });

  const full = await prisma.libraryDocument.findUnique({
    where: { id: doc.id },
    include: docInclude,
  });

  return NextResponse.json(full, { status: 201 });
}
