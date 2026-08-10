import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import {
  authorizeDocumentAccess,
  loadDocumentForOrg,
} from "@/lib/document-access";
import { getR2Object } from "@/lib/r2";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await loadDocumentForOrg(id, auth.org.organizationId);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.committee && doc.committee.organizationId !== auth.org.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = authorizeDocumentAccess(auth.user, doc);
  if (error) return error;

  if (!doc.storageKey) {
    if (doc.fileUrl) {
      return NextResponse.redirect(doc.fileUrl);
    }
    return NextResponse.json({ error: "No file stored" }, { status: 404 });
  }

  try {
    const object = await getR2Object(doc.storageKey);
    const fileName = doc.fileName || "document";
    const headers = new Headers({
      "Content-Type": doc.mimeType || object.contentType || "application/octet-stream",
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
    console.error("R2 download failed:", doc.storageKey, err);
    return NextResponse.json({ error: "Failed to load file" }, { status: 502 });
  }
}
