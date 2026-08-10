import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  authorizeDocumentAccess,
  loadDocumentForOrg,
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

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(versions);
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

  const { error } = authorizeDocumentAccess(auth.user, doc, { requireEdit: true });
  if (error) return error;

  const body = (await request.json()) as { versionId?: string };
  if (!body.versionId) {
    return NextResponse.json({ error: "versionId required" }, { status: 400 });
  }

  const version = await prisma.documentVersion.findFirst({
    where: { id: body.versionId, documentId: id },
  });
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const content = version.contentJson as Record<string, unknown>;
  const html =
    typeof content.html === "string"
      ? content.html
      : typeof doc.body === "string"
        ? doc.body
        : "";

  const updated = await prisma.libraryDocument.update({
    where: { id },
    data: {
      contentJson: version.contentJson as object,
      body: html || doc.body,
    },
  });

  await prisma.documentVersion.create({
    data: {
      documentId: id,
      contentJson: version.contentJson as object,
      createdById: auth.user.id,
    },
  });

  return NextResponse.json(updated);
}
