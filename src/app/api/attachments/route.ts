import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  assertAttachmentRead,
  assertAttachmentWrite,
  ATTACHMENT_ENTITY_TYPES,
} from "@/lib/attachment-access";
import { prisma } from "@/lib/prisma";
import {
  buildR2Key,
  deleteR2Object,
  isR2Configured,
  putR2Object,
  sanitizeStorageFileName,
} from "@/lib/r2";
import type { EntityType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") as EntityType | null;
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId || !ATTACHMENT_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  }

  const accessError = await assertAttachmentRead(
    auth.user,
    entityType,
    entityId,
  );
  if (accessError) return accessError;

  const attachments = await prisma.document.findMany({
    where: { entityType, entityId },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(attachments);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "File storage is not configured on this server" },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const entityType = formData.get("entityType") as EntityType | null;
    const entityId = (formData.get("entityId") as string | null)?.trim();

    if (!file || !entityType || !entityId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!ATTACHMENT_ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 25 MB)" },
        { status: 400 },
      );
    }

    const mutationError = await assertAttachmentWrite(
      auth.user,
      entityType,
      entityId,
    );
    if (mutationError) return mutationError;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = sanitizeStorageFileName(file.name);
    const mimeType = file.type || "application/octet-stream";

    const attachment = await prisma.document.create({
      data: {
        fileName: file.name,
        storageKey: "",
        mimeType,
        entityType,
        entityId,
        uploadedById: auth.user.id,
      },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    const storageKey = buildR2Key(
      "attachments",
      entityType.toLowerCase(),
      entityId,
      attachment.id,
      safeName,
    );

    await putR2Object({ key: storageKey, body: buffer, contentType: mimeType });

    const updated = await prisma.document.update({
      where: { id: attachment.id },
      data: { storageKey },
      include: { uploadedBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updated, { status: 201 });
  } catch (err) {
    console.error("Attachment upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const attachment = await prisma.document.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const mutationError = await assertAttachmentWrite(
    auth.user,
    attachment.entityType,
    attachment.entityId,
  );
  if (mutationError) return mutationError;

  if (attachment.storageKey) {
    await deleteR2Object(attachment.storageKey);
  }

  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
