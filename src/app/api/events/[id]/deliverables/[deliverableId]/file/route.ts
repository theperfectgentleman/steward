import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { requireEventCommitteeId } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";
import { getR2Object } from "@/lib/r2";
import { canEditTasks } from "@/lib/types";

export async function GET(
  _request: Request,
  {
    params,
  }: { params: Promise<{ id: string; deliverableId: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id: eventId, deliverableId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const missing = requireEventCommitteeId(event.committeeId);
  if (missing) return missing;

  const access = assertCommitteeAccess(auth.user, event.committeeId!);
  if (access) return access;

  const deliverable = await prisma.eventDeliverable.findFirst({
    where: { id: deliverableId, eventId },
  });
  if (!deliverable || deliverable.kind !== "FILE" || !deliverable.storageKey) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const object = await getR2Object(deliverable.storageKey);
    const fileName = deliverable.fileName || deliverable.title || "file";
    const headers = new Headers({
      "Content-Type":
        deliverable.mimeType || object.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    });
    if (object.contentLength != null) {
      headers.set("Content-Length", String(object.contentLength));
    }

    const body = object.body as { transformToWebStream?: () => ReadableStream };
    if (typeof body.transformToWebStream === "function") {
      return new NextResponse(body.transformToWebStream(), { headers });
    }

    const bytes = await (object.body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return new NextResponse(Buffer.from(bytes), { headers });
  } catch (err) {
    console.error("Deliverable download failed:", deliverable.storageKey, err);
    return NextResponse.json({ error: "Failed to load file" }, { status: 502 });
  }
}
