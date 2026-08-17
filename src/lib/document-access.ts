import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth";
import { asPermissionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canReadDocuments, canViewAllCommittees } from "@/lib/types";
import type { LibraryDocumentTag, NativeDocKind } from "@/lib/documents";
import {
  DOCUMENT_MEMBER_ROLES,
  DOCUMENT_ROLE_LABELS,
  DOCUMENT_STATUS_LABELS,
  type DocumentMemberRole,
  type LibraryDocumentStatus,
} from "@/lib/documents";

export type { DocumentMemberRole, LibraryDocumentStatus };
export { DOCUMENT_MEMBER_ROLES, DOCUMENT_ROLE_LABELS, DOCUMENT_STATUS_LABELS };

const EDIT_ROLES: DocumentMemberRole[] = ["OWNER", "EDITOR"];
const COMMENT_ROLES: DocumentMemberRole[] = [
  "OWNER",
  "EDITOR",
  "REVIEWER",
  "APPROVER",
];
const MANAGE_ROLES: DocumentMemberRole[] = ["OWNER"];
const APPROVE_ROLES: DocumentMemberRole[] = ["APPROVER", "OWNER"];
const REVIEW_ROLES: DocumentMemberRole[] = ["REVIEWER", "OWNER"];

const EDITABLE_STATUSES: LibraryDocumentStatus[] = ["DRAFT", "RETURNED"];

export type DocumentCapabilities = {
  /** Edit title/body — editors only while draft/returned */
  canEdit: boolean;
  canComment: boolean;
  canManage: boolean;
  /** Editors/owners can link related work even when content is locked */
  canManageLinks: boolean;
  /** Draft/returned → in review */
  canSubmit: boolean;
  /** In review → pending approval */
  canCompleteReview: boolean;
  /** Pending approval → published */
  canPublish: boolean;
  /** Send back to returned from review or pending approval */
  canReturn: boolean;
};

export function canEditDocument(role: DocumentMemberRole | null | undefined) {
  return role != null && EDIT_ROLES.includes(role);
}

export function canCommentOnDocument(role: DocumentMemberRole | null | undefined) {
  return role != null && COMMENT_ROLES.includes(role);
}

export function canManageDocumentMembers(role: DocumentMemberRole | null | undefined) {
  return role != null && MANAGE_ROLES.includes(role);
}

export function canApproveDocument(role: DocumentMemberRole | null | undefined) {
  return role != null && APPROVE_ROLES.includes(role);
}

export function canReviewDocument(role: DocumentMemberRole | null | undefined) {
  return role != null && REVIEW_ROLES.includes(role);
}

export function canSubmitForReview(role: DocumentMemberRole | null | undefined) {
  return role != null && EDIT_ROLES.includes(role);
}

export function isEditableDocumentStatus(status: LibraryDocumentStatus) {
  return EDITABLE_STATUSES.includes(status);
}

export function getDocumentCapabilities(
  role: DocumentMemberRole | null | undefined,
  status: LibraryDocumentStatus,
): DocumentCapabilities {
  const editor = canEditDocument(role);
  const reviewer = canReviewDocument(role);
  const approver = canApproveDocument(role);
  const editable = isEditableDocumentStatus(status);

  return {
    canEdit: editor && editable,
    canComment: canCommentOnDocument(role),
    canManage: canManageDocumentMembers(role),
    canManageLinks: editor,
    canSubmit: editor && editable,
    canCompleteReview: reviewer && status === "IN_REVIEW",
    canPublish: approver && status === "APPROVED",
    canReturn:
      (reviewer && status === "IN_REVIEW") ||
      (approver && status === "APPROVED"),
  };
}

/** Validate a status change for the actor's role. */
export function assertDocumentStatusTransition(
  from: LibraryDocumentStatus,
  to: LibraryDocumentStatus,
  role: DocumentMemberRole | null | undefined,
): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: true };

  const allowed: Partial<
    Record<
      LibraryDocumentStatus,
      Partial<Record<LibraryDocumentStatus, (r: DocumentMemberRole | null | undefined) => boolean>>
    >
  > = {
    DRAFT: {
      IN_REVIEW: canSubmitForReview,
    },
    RETURNED: {
      IN_REVIEW: canSubmitForReview,
    },
    IN_REVIEW: {
      APPROVED: canReviewDocument,
      RETURNED: canReviewDocument,
    },
    APPROVED: {
      PUBLISHED: canApproveDocument,
      RETURNED: canApproveDocument,
    },
  };

  const gate = allowed[from]?.[to];
  if (!gate) {
    return {
      ok: false,
      error: `Cannot move from ${DOCUMENT_STATUS_LABELS[from]} to ${DOCUMENT_STATUS_LABELS[to]}`,
    };
  }
  if (!gate(role)) {
    return { ok: false, error: "Not authorized for this stage action" };
  }
  return { ok: true };
}

type DocAccessRow = {
  id: string;
  organizationId: string;
  committeeId: string | null;
  uploadedById: string;
  archivedAt?: Date | null;
  members?: { userId: string; role: DocumentMemberRole }[];
};

export async function loadDocumentForOrg(documentId: string, organizationId: string) {
  return prisma.libraryDocument.findFirst({
    where: {
      id: documentId,
      organizationId,
      archivedAt: null,
    },
    include: {
      committee: {
        select: { id: true, name: true, charterLetter: true, organizationId: true },
      },
      uploadedBy: { select: { id: true, name: true } },
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      links: true,
      versions: {
        select: { id: true, createdAt: true, createdById: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export function memberRoleForUser(
  doc: DocAccessRow,
  userId: string,
): DocumentMemberRole | null {
  const membership = doc.members?.find((m) => m.userId === userId);
  if (membership) return membership.role;
  if (doc.uploadedById === userId) return "OWNER";
  return null;
}

/** Committee/org visibility without requiring membership (legacy readers). */
export function authorizeDocumentRead(
  user: SessionUser,
  committeeId: string | null,
): NextResponse | null {
  const perm = asPermissionUser(user);
  if (perm.role === "ORG_TECH") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (canViewAllCommittees(perm)) return null;
  if (committeeId) {
    if (!canReadDocuments(perm, committeeId)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    return null;
  }
  if (user.committeeMemberships.length === 0 && !canViewAllCommittees(perm)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  return null;
}

/**
 * Prefer explicit DocumentMember; fall back to committee read for legacy docs
 * with no members yet (owner = uploader).
 */
export function authorizeDocumentAccess(
  user: SessionUser,
  doc: DocAccessRow,
  opts: { requireEdit?: boolean; requireComment?: boolean; requireManage?: boolean; requireApprove?: boolean } = {},
): { role: DocumentMemberRole | null; error: NextResponse | null } {
  const readDenied = authorizeDocumentRead(user, doc.committeeId);
  if (readDenied) return { role: null, error: readDenied };

  let role = memberRoleForUser(doc, user.id);
  const hasMembers = (doc.members?.length ?? 0) > 0;

  // Legacy docs without members: committee readers can view; uploader owns;
  // org admins / supervisory can edit.
  if (!hasMembers && !role) {
    const perm = asPermissionUser(user);
    if (canViewAllCommittees(perm)) role = "EDITOR";
  }

  if (opts.requireEdit && !canEditDocument(role)) {
    return {
      role,
      error: NextResponse.json({ error: "Editors only" }, { status: 403 }),
    };
  }
  if (opts.requireComment && !canCommentOnDocument(role) && !role) {
    // Allow committee readers to comment on legacy docs
    if (!hasMembers) {
      return { role: "REVIEWER", error: null };
    }
    return {
      role,
      error: NextResponse.json({ error: "Not authorized to comment" }, { status: 403 }),
    };
  }
  if (opts.requireComment && hasMembers && !canCommentOnDocument(role)) {
    return {
      role,
      error: NextResponse.json({ error: "Not authorized to comment" }, { status: 403 }),
    };
  }
  if (opts.requireManage && !canManageDocumentMembers(role)) {
    return {
      role,
      error: NextResponse.json({ error: "Owners only" }, { status: 403 }),
    };
  }
  if (opts.requireApprove && !canApproveDocument(role)) {
    return {
      role,
      error: NextResponse.json({ error: "Approvers only" }, { status: 403 }),
    };
  }

  return { role, error: null };
}

export async function resolveDefaultApproverIds(opts: {
  organizationId: string;
  committeeId?: string | null;
  tag: LibraryDocumentTag;
}): Promise<string[]> {
  const preferSecretary = opts.tag === "REPORT" || opts.tag === "MINUTES";

  if (preferSecretary || !opts.committeeId) {
    const secretaries = await prisma.supervisoryMember.findMany({
      where: {
        group: { organizationId: opts.organizationId },
        title: "SECRETARY",
      },
      select: { userId: true },
      take: 3,
    });
    if (secretaries.length > 0) return secretaries.map((s) => s.userId);
  }

  if (opts.committeeId) {
    const chairs = await prisma.committeeMember.findMany({
      where: { committeeId: opts.committeeId, title: "CHAIR" },
      select: { userId: true },
      take: 2,
    });
    if (chairs.length > 0) return chairs.map((c) => c.userId);

    const secretaries = await prisma.committeeMember.findMany({
      where: { committeeId: opts.committeeId, title: "SECRETARY" },
      select: { userId: true },
      take: 2,
    });
    if (secretaries.length > 0) return secretaries.map((s) => s.userId);
  }

  const fallback = await prisma.supervisoryMember.findMany({
    where: {
      group: { organizationId: opts.organizationId },
      OR: [{ title: "SECRETARY" }, { isHead: true }],
    },
    select: { userId: true },
    take: 2,
  });
  return fallback.map((f) => f.userId);
}

export async function createDocumentMembers(opts: {
  documentId: string;
  ownerId: string;
  editors?: string[];
  reviewers?: string[];
  approvers?: string[];
}) {
  const rows: { documentId: string; userId: string; role: DocumentMemberRole }[] = [
    { documentId: opts.documentId, userId: opts.ownerId, role: "OWNER" },
  ];
  const seen = new Set<string>([opts.ownerId]);

  for (const userId of opts.editors ?? []) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    rows.push({ documentId: opts.documentId, userId, role: "EDITOR" });
  }
  for (const userId of opts.reviewers ?? []) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    rows.push({ documentId: opts.documentId, userId, role: "REVIEWER" });
  }
  for (const userId of opts.approvers ?? []) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    rows.push({ documentId: opts.documentId, userId, role: "APPROVER" });
  }

  await prisma.documentMember.createMany({ data: rows });
}

export function parseNativeKind(value: unknown): NativeDocKind {
  if (value === "SPREADSHEET" || value === "PRESENTATION" || value === "DOCUMENT") {
    return value;
  }
  return "DOCUMENT";
}
