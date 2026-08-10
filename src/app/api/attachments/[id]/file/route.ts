import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertAttachmentRead } from "@/lib/attachment-access";
import { prisma } from "@/lib/prisma";
import { getR2Object } from "@/lib/r2";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const attachment = await prisma.document.findUnique({ where: { id } });
  if (!attachment?.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const accessError = await assertAttachmentRead(
    auth.user,
    attachment.entityType,
    attachment.entityId,
  );
  if (accessError) return accessError;

  try {
    const object = await getR2Object(attachment.storageKey);
    const headers = new Headers({
      "Content-Type":
        attachment.mimeType || object.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.fileName)}"`,
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
    console.error("Attachment download failed:", attachment.storageKey, err);
    return NextResponse.json({ error: "Failed to load file" }, { status: 502 });
  }
}
