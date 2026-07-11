import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertNotReadOnly,
  requireUser,
} from "@/lib/auth";
import { generateTaskDrafts } from "@/lib/ai/groq";
import { prisma } from "@/lib/prisma";
import { canEditTasks } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const readOnly = assertNotReadOnly(auth.user);
  if (readOnly) return readOnly;

  if (!canEditTasks(auth.user.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId);
  if (access) return access;

  if (!event.description?.trim()) {
    return NextResponse.json(
      { error: "Add an event description before generating tasks" },
      { status: 400 },
    );
  }

  try {
    const drafts = await generateTaskDrafts(event.title, event.description);
    return NextResponse.json({ drafts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
