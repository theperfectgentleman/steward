import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertNotReadOnly,
  requireUser,
} from "@/lib/auth";
import { getEventWithProgress } from "@/lib/event-queries";
import { prisma } from "@/lib/prisma";
import { canEditTasks } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { id } = await params;
  const event = await getEventWithProgress(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const access = assertCommitteeAccess(auth.user, event.committeeId);
  if (access) return access;

  return NextResponse.json(event);
}

export async function PATCH(
  request: Request,
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
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const access = assertCommitteeAccess(auth.user, existing.committeeId);
  if (access) return access;

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    startDate?: string;
    endDate?: string | null;
  };

  await prisma.event.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.startDate !== undefined && {
        startDate: new Date(body.startDate),
      }),
      ...(body.endDate !== undefined && {
        endDate: body.endDate ? new Date(body.endDate) : null,
      }),
    },
  });

  const event = await getEventWithProgress(id);
  return NextResponse.json(event);
}
