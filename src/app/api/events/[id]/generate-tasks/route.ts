import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { assertEventOrgMutation, requireEventCommitteeId } from "@/lib/event-access";
import { generateTaskDrafts } from "@/lib/ai/groq";
import { EVENT_KIND_LABELS, getEventKindProfile } from "@/lib/event-kinds";
import { prisma } from "@/lib/prisma";
import { type ScheduleKind } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id } = await params;
  const orgId = auth.org.organizationId;
  const event = await prisma.event.findFirst({
    where: { id, organizationId: orgId },
    include: { agendaItems: { orderBy: { order: "asc" }, select: { title: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const missing = requireEventCommitteeId(event.committeeId);
  if (missing) return missing;

  const mutation = assertEventOrgMutation(auth.user, event, orgId);
  if (mutation) return mutation;

  const profile = getEventKindProfile(event.kind);
  if (!profile.tasks) {
    return NextResponse.json(
      { error: "Tasks are not available for this event type" },
      { status: 400 },
    );
  }

  if (!event.description?.trim()) {
    return NextResponse.json(
      { error: "Add an event description before generating tasks" },
      { status: 400 },
    );
  }

  const kind = event.kind as ScheduleKind;

  try {
    const drafts = await generateTaskDrafts(event.title, event.description, {
      kindLabel: EVENT_KIND_LABELS[kind] ?? kind,
      agendaNotes: profile.agenda ? event.agenda : null,
      agendaItems: profile.agenda
        ? event.agendaItems.map((a) => a.title)
        : undefined,
    });
    return NextResponse.json({ drafts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
