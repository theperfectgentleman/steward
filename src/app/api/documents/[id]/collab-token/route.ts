import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import {
  authorizeDocumentAccess,
  getDocumentCapabilities,
  loadDocumentForOrg,
} from "@/lib/document-access";
import {
  getCollabWsUrl,
  isCollabDisabled,
  signCollabToken,
} from "@/lib/collab-token";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  if (isCollabDisabled()) {
    return NextResponse.json({
      mode: "local",
      disabled: true,
      reason: "DISABLE_COLLAB",
    });
  }

  const { id } = await params;
  const doc = await loadDocumentForOrg(id, auth.org.organizationId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { role, error } = authorizeDocumentAccess(auth.user, doc);
  if (error) return error;

  const caps = getDocumentCapabilities(role, doc.status);
  const canWrite = caps.canEdit;
  const token = signCollabToken({
    documentId: id,
    userId: auth.user.id,
    userName: auth.user.name,
    canWrite,
  });

  return NextResponse.json({
    mode: "live",
    token,
    wsUrl: getCollabWsUrl(),
    canWrite,
    documentId: id,
  });
}
