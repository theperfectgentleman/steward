import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { requireEventCommitteeId } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";
import {
  buildR2Key,
  deleteR2Object,
  isR2Configured,
  putR2Object,
  sanitizeStorageFileName,
} from "@/lib/r2";
import { canEditTasks } from "@/lib/types";

const MAX_BYTES = 25 * 1024 * 1024;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const missing = requireEventCommitteeId(event.committeeId);
  if (missing) return missing;

  const access = assertCommitteeAccess(auth.user, event.committeeId!);
  if (access) return access;

  const deliverables = await prisma.eventDeliverable.findMany({
    where: { eventId },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(deliverables);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const missing = requireEventCommitteeId(event.committeeId);
  if (missing) return missing;

  const mutation = assertCommitteeMutation(auth.user, event.committeeId!);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, event.committeeId!)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId!);
  if (access) return access;

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    if (!isR2Configured()) {
      return NextResponse.json(
        { error: "File storage is not configured on this server" },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const titleInput = (formData.get("title") as string | null)?.trim();

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 25 MB)" },
        { status: 400 },
      );
    }

    const title = titleInput || file.name.replace(/\.[^/.]+$/, "") || file.name;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeName = sanitizeStorageFileName(file.name);
    const mimeType = file.type || "application/octet-stream";

    const deliverable = await prisma.eventDeliverable.create({
      data: {
        eventId,
        title,
        kind: "FILE",
        content: file.name,
        fileName: file.name,
        mimeType,
        createdById: auth.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    const committee = await prisma.committee.findUnique({
      where: { id: event.committeeId! },
      select: { organizationId: true },
    });
    const orgId = committee?.organizationId ?? "unknown";

    const storageKey = buildR2Key(
      "orgs",
      orgId,
      "events",
      eventId,
      "deliverables",
      deliverable.id,
      safeName,
    );

    await putR2Object({
      key: storageKey,
      body: buffer,
      contentType: mimeType,
    });

    const updated = await prisma.eventDeliverable.update({
      where: { id: deliverable.id },
      data: { storageKey },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    return NextResponse.json(updated, { status: 201 });
  }

  const body = (await request.json()) as {
    title?: string;
    kind?: "NOTE" | "LINK";
    content?: string;
  };

  if (!body.title?.trim() || !body.kind || !body.content?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (body.kind === "LINK") {
    try {
      new URL(body.content);
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  const deliverable = await prisma.eventDeliverable.create({
    data: {
      eventId,
      title: body.title.trim(),
      kind: body.kind,
      content: body.content.trim(),
      createdById: auth.user.id,
    },
    include: { createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(deliverable, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const missing = requireEventCommitteeId(event.committeeId);
  if (missing) return missing;

  const mutation = assertCommitteeMutation(auth.user, event.committeeId!);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, event.committeeId!)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId!);
  if (access) return access;

  const { searchParams } = new URL(request.url);
  const deliverableId = searchParams.get("deliverableId");
  if (!deliverableId) {
    return NextResponse.json({ error: "deliverableId required" }, { status: 400 });
  }

  const existing = await prisma.eventDeliverable.findFirst({
    where: { id: deliverableId, eventId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Deliverable not found" }, { status: 404 });
  }

  if (existing.storageKey) {
    await deleteR2Object(existing.storageKey);
  }

  await prisma.eventDeliverable.delete({ where: { id: deliverableId } });
  return NextResponse.json({ ok: true });
}
