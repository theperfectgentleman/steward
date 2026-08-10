import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  asPermissionUser,
  requireActiveOrg,
} from "@/lib/auth";
import { generateTorWorkDrafts } from "@/lib/ai/groq";
import { prisma } from "@/lib/prisma";
import { canEditTasks, canReadDocuments, canViewAllCommittees } from "@/lib/types";

function plainFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const doc = await prisma.libraryDocument.findFirst({
    where: {
      id,
      OR: [{ organizationId: auth.org.organizationId }, { organizationId: null }],
      archivedAt: null,
    },
    include: {
      committee: { select: { id: true, name: true, organizationId: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.committee && doc.committee.organizationId !== auth.org.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!doc.committeeId || !doc.committee) {
    return NextResponse.json(
      { error: "Assign this document to a committee before suggesting work" },
      { status: 400 },
    );
  }

  const perm = asPermissionUser(auth.user);
  const access = assertCommitteeAccess(auth.user, doc.committeeId);
  if (access) return access;

  if (
    !canEditTasks(perm, doc.committeeId) &&
    !canReadDocuments(perm, doc.committeeId) &&
    !canViewAllCommittees(perm)
  ) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const text =
    plainFromHtml(doc.body ?? "") ||
    [doc.fileName, doc.fileUrl].filter(Boolean).join("\n") ||
    "";

  if (!text) {
    return NextResponse.json(
      { error: "Add TOR content before requesting work suggestions" },
      { status: 400 },
    );
  }

  try {
    const drafts = await generateTorWorkDrafts(
      doc.title,
      text,
      doc.committee.name,
    );
    return NextResponse.json({ drafts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
