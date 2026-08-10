import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import {
  generateAssistJson,
  generateAssistSuggestion,
} from "@/lib/ai/groq";
import {
  assistSystemPrompt,
  assistUserPrompt,
  isAssistType,
  type AssistType,
} from "@/lib/ai/assists";
import { prisma } from "@/lib/prisma";

type AssistBody = {
  type?: AssistType;
  eventId?: string;
  title?: string;
  description?: string;
  agenda?: string;
  context?: string;
};

async function loadContext(
  body: AssistBody,
  orgId: string,
): Promise<Record<string, string | null | undefined>> {
  const ctx: Record<string, string | null | undefined> = {
    title: body.title,
    description: body.description,
    agenda: body.agenda,
    notes: body.context,
  };

  if (body.eventId) {
    const event = await prisma.event.findFirst({
      where: {
        id: body.eventId,
        OR: [
          { organizationId: orgId },
          { committee: { organizationId: orgId } },
        ],
      },
    });
    if (event) {
      ctx.title = ctx.title ?? event.title;
      ctx.description = ctx.description ?? event.description;
      ctx.agenda = ctx.agenda ?? event.agenda;
    }
  }

  return ctx;
}

export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const body = (await request.json()) as AssistBody;
  if (!isAssistType(body.type)) {
    return NextResponse.json(
      {
        error:
          "type must be approval_brief, agenda_suggest, or minutes_draft",
      },
      { status: 400 },
    );
  }

  const context = await loadContext(body, auth.org.organizationId);

  try {
    if (body.type === "agenda_suggest") {
      const parsed = await generateAssistJson(
        `${assistSystemPrompt(body.type)} Optionally return JSON: { "items": string[] }.`,
        `${assistUserPrompt(body.type, context)}\n\nRespond with JSON: { "suggestion": "...", "items": ["..."] }`,
      );
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        const suggestion =
          typeof obj.suggestion === "string"
            ? obj.suggestion
            : Array.isArray(obj.items)
              ? obj.items
                  .filter((x): x is string => typeof x === "string")
                  .map((x, i) => `${i + 1}. ${x}`)
                  .join("\n")
              : null;
        if (suggestion) {
          return NextResponse.json({
            suggestion,
            items: Array.isArray(obj.items) ? obj.items : undefined,
          });
        }
      }
    }

    const suggestion = await generateAssistSuggestion(
      assistSystemPrompt(body.type),
      assistUserPrompt(body.type, context),
    );
    return NextResponse.json({ suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI assist failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
