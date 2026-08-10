import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { generateTaskDrafts } from "@/lib/ai/groq";
import { EVENT_KIND_LABELS, getEventKindProfile } from "@/lib/event-kinds";
import { requireEventCommitteeId } from "@/lib/event-access";
import { prisma } from "@/lib/prisma";
import { canEditTasks, type ScheduleKind } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: { agendaItems: { orderBy: { order: "asc" }, select: { title: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const missing = requireEventCommitteeId(event.committeeId);
  if (missing) return missing;

  const mutation = assertCommitteeMutation(auth.user, event.committeeId!);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, event.committeeId!)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId!);
  if (access) return access;

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
