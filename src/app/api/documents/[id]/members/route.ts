import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/prisma";
import {
  authorizeDocumentAccess,
  DOCUMENT_MEMBER_ROLES,
  loadDocumentForOrg,
  type DocumentMemberRole,
} from "@/lib/document-access";

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

  return NextResponse.json(doc.members);
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

  const { error } = authorizeDocumentAccess(auth.user, doc, {
    requireManage: true,
  });
  if (error) return error;

  const body = (await request.json()) as {
    userId?: string;
    role?: DocumentMemberRole;
  };

  if (!body.userId || !body.role || !DOCUMENT_MEMBER_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "userId and role required" }, { status: 400 });
  }

  if (body.role === "OWNER") {
    return NextResponse.json(
      { error: "Cannot assign OWNER via invite; transfer ownership separately" },
      { status: 400 },
    );
  }

  const membership = await prisma.organizationMembership.findFirst({
    where: {
      organizationId: auth.org.organizationId,
      userId: body.userId,
    },
  });
  if (!membership) {
    return NextResponse.json({ error: "User not in organization" }, { status: 400 });
  }

  const member = await prisma.documentMember.upsert({
    where: {
      documentId_userId: { documentId: id, userId: body.userId },
    },
    create: {
      documentId: id,
      userId: body.userId,
      role: body.role,
    },
    update: { role: body.role },
    include: { user: { select: { id: true, name: true } } },
  });

  await logActivity({
    entityType: "LIBRARY_DOCUMENT",
    entityId: id,
    action: "DOCUMENT_MEMBER_ADDED",
    actorId: auth.user.id,
    metadata: { userId: body.userId, role: body.role },
  });

  return NextResponse.json(member, { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await loadDocumentForOrg(id, auth.org.organizationId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = authorizeDocumentAccess(auth.user, doc, {
    requireManage: true,
  });
  if (error) return error;

  const body = (await request.json()) as {
    userId?: string;
    role?: DocumentMemberRole;
  };

  if (!body.userId || !body.role || !DOCUMENT_MEMBER_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "userId and role required" }, { status: 400 });
  }

  if (body.role === "OWNER") {
    return NextResponse.json({ error: "Use ownership transfer" }, { status: 400 });
  }

  const existing = doc.members.find((m) => m.userId === body.userId);
  if (!existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (existing.role === "OWNER") {
    return NextResponse.json({ error: "Cannot change owner role" }, { status: 400 });
  }

  const member = await prisma.documentMember.update({
    where: { documentId_userId: { documentId: id, userId: body.userId } },
    data: { role: body.role },
    include: { user: { select: { id: true, name: true } } },
  });

  await logActivity({
    entityType: "LIBRARY_DOCUMENT",
    entityId: id,
    action: "DOCUMENT_MEMBER_UPDATED",
    actorId: auth.user.id,
    metadata: { userId: body.userId, role: body.role },
  });

  return NextResponse.json(member);
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

  const { error } = authorizeDocumentAccess(auth.user, doc, {
    requireManage: true,
  });
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const existing = doc.members.find((m) => m.userId === userId);
  if (!existing) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  if (existing.role === "OWNER") {
    return NextResponse.json({ error: "Cannot remove owner" }, { status: 400 });
  }

  await prisma.documentMember.delete({
    where: { documentId_userId: { documentId: id, userId } },
  });

  await logActivity({
    entityType: "LIBRARY_DOCUMENT",
    entityId: id,
    action: "DOCUMENT_MEMBER_REMOVED",
    actorId: auth.user.id,
    metadata: { userId },
  });

  return NextResponse.json({ ok: true });
}
