import { NextResponse } from "next/server";
import {
  asPermissionUser,
  assertCommitteeAccess,
  requireActiveOrg,
} from "@/lib/auth";
import {
  answerDocumentQuestion,
  extractReviewPoints,
  summarizeDocument,
} from "@/lib/ai/groq";
import { prisma } from "@/lib/prisma";
import { canReadDocuments, canViewAllCommittees } from "@/lib/types";

type AiAction = "summarize" | "extract" | "ask";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json()) as {
    action?: AiAction;
    question?: string;
  };

  if (!body.action || !["summarize", "extract", "ask"].includes(body.action)) {
    return NextResponse.json(
      { error: "action must be summarize, extract, or ask" },
      { status: 400 },
    );
  }

  if (body.action === "ask" && !body.question?.trim()) {
    return NextResponse.json({ error: "question required for ask" }, { status: 400 });
  }

  const doc = await prisma.libraryDocument.findFirst({
    where: {
      id,
      OR: [{ organizationId: auth.org.organizationId }, { organizationId: null }],
    },
    include: {
      committee: { select: { organizationId: true } },
    },
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (doc.committee && doc.committee.organizationId !== auth.org.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const perm = asPermissionUser(auth.user);
  if (doc.committeeId) {
    const access = assertCommitteeAccess(auth.user, doc.committeeId);
    if (access) return access;
    if (!canReadDocuments(perm, doc.committeeId) && !canViewAllCommittees(perm)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (!canViewAllCommittees(perm) && !canReadDocuments(perm)) {
    if (auth.user.committeeMemberships.length === 0) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  const text =
    doc.body?.trim() ||
    [doc.fileName, doc.fileUrl].filter(Boolean).join("\n") ||
    "";

  if (!text) {
    return NextResponse.json(
      { error: "Document has no content to analyze" },
      { status: 400 },
    );
  }

  try {
    if (body.action === "summarize") {
      const suggestion = await summarizeDocument(doc.title, text);
      return NextResponse.json({ suggestion });
    }
    if (body.action === "extract") {
      const points = await extractReviewPoints(doc.title, text);
      const suggestion = [
        points.risks.length
          ? `Risks:\n${points.risks.map((r) => `• ${r}`).join("\n")}`
          : "Risks: (none identified)",
        points.actions.length
          ? `Actions:\n${points.actions.map((a) => `• ${a}`).join("\n")}`
          : "Actions: (none identified)",
      ].join("\n\n");
      return NextResponse.json({ suggestion, ...points });
    }
    const suggestion = await answerDocumentQuestion(
      doc.title,
      text,
      body.question!.trim(),
    );
    return NextResponse.json({ suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
