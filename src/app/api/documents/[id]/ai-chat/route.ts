import { NextResponse } from "next/server";
import { requireActiveOrg, asPermissionUser } from "@/lib/auth";
import { isOrgTech } from "@/lib/types";
import {
  authorizeDocumentAccess,
  loadDocumentForOrg,
} from "@/lib/document-access";
import {
  answerDocumentQuestion,
  extractReviewPoints,
  summarizeDocument,
} from "@/lib/ai/groq";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  if (isOrgTech(perm)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { id } = await params;
  const doc = await loadDocumentForOrg(id, auth.org.organizationId);
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { error } = authorizeDocumentAccess(auth.user, doc);
  if (error) return error;

  const { prompt } = (await request.json()) as { prompt?: string };
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt required" }, { status: 400 });
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

  const userPrompt = prompt.trim().toLowerCase();
  try {
    let reply: string;
    if (userPrompt.includes("summar") || userPrompt.includes("overview")) {
      reply = await summarizeDocument(doc.title, text);
    } else if (
      userPrompt.includes("risk") ||
      userPrompt.includes("action") ||
      userPrompt.includes("extract")
    ) {
      const points = await extractReviewPoints(doc.title, text);
      const risks =
        points.risks.length > 0
          ? points.risks.map((r) => `• ${r}`).join("\n")
          : "• None identified";
      const actions =
        points.actions.length > 0
          ? points.actions.map((a) => `• ${a}`).join("\n")
          : "• None identified";
      reply = `Risks / concerns\n${risks}\n\nSuggested actions\n${actions}`;
    } else {
      reply = await answerDocumentQuestion(doc.title, text, prompt.trim());
    }
    return NextResponse.json({
      reply,
      note: "Suggestion only — review before applying or posting.",
    });
  } catch (err) {
    console.error("ai-chat error", err);
    return NextResponse.json(
      { error: "AI request failed. Check GROQ_API_KEY and try again." },
      { status: 502 },
    );
  }
}
