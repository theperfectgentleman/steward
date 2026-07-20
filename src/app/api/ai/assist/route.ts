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
  assignmentId?: string;
  projectId?: string;
  reportId?: string;
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

  if (body.assignmentId) {
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: body.assignmentId,
        OR: [
          { targetCommittee: { organizationId: orgId } },
          { sourceCommittee: { organizationId: orgId } },
        ],
      },
    });
    if (assignment) {
      ctx.title = ctx.title ?? assignment.title;
      ctx.description = ctx.description ?? assignment.description;
      ctx.assignmentStatus = assignment.status;
      ctx.priority = assignment.priority;
    }
  }

  if (body.projectId) {
    const project = await prisma.project.findFirst({
      where: {
        id: body.projectId,
        committee: { organizationId: orgId },
      },
      include: {
        tasks: {
          where: { parentId: null },
          select: { title: true, status: true },
          take: 20,
        },
      },
    });
    if (project) {
      ctx.title = ctx.title ?? project.title;
      ctx.description = ctx.description ?? project.description;
      ctx.projectStatus = project.status;
      ctx.tasks = project.tasks
        .map((t) => `${t.title} (${t.status})`)
        .join("; ");
    }
  }

  if (body.reportId) {
    const report = await prisma.report.findFirst({
      where: { id: body.reportId, organizationId: orgId },
      include: { project: { select: { title: true, description: true } } },
    });
    if (report) {
      ctx.title = ctx.title ?? report.title;
      ctx.description = ctx.description ?? report.body;
      ctx.projectTitle = report.project.title;
      ctx.projectDescription = report.project.description;
    }
  }

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
          "type must be report_draft, approval_brief, agenda_suggest, minutes_draft, or assignment_scope",
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
