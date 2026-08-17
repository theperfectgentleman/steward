import { NextResponse } from "next/server";
import { asPermissionUser, requireActiveOrg } from "@/lib/auth";
import { assertEventOrgAccess, assertEventOrgMutation } from "@/lib/event-access";
import {
  ensureMeetingForEvent,
  getMeetingForEvent,
} from "@/lib/meeting-for-event";
import { prisma } from "@/lib/prisma";
import { canApproveMinutes, canLogMinutes, canViewAllCommittees } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const orgId = auth.org.organizationId;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const access = assertEventOrgAccess(auth.user, event, orgId);
  if (access) return access;

  const meeting =
    (await getMeetingForEvent(eventId)) ??
    (event.kind === "MEETING" ? await ensureMeetingForEvent(eventId) : null);

  return NextResponse.json(meeting);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { id: eventId } = await params;
  const orgId = auth.org.organizationId;
  const event = await prisma.event.findFirst({
    where: { id: eventId, organizationId: orgId },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const mutation = assertEventOrgMutation(auth.user, event, orgId);
  if (mutation) return mutation;

  const access = assertEventOrgAccess(auth.user, event, orgId);
  if (access) return access;

  const perm = asPermissionUser(auth.user);
  const body = (await request.json()) as {
    points?: string[];
    approved?: boolean;
  };

  const meeting =
    (await ensureMeetingForEvent(eventId)) ??
    (await getMeetingForEvent(eventId));
  if (!meeting) {
    return NextResponse.json({ error: "Not a meeting event" }, { status: 400 });
  }

  if (body.approved !== undefined) {
    const ok = event.committeeId
      ? canApproveMinutes(perm, event.committeeId)
      : canViewAllCommittees(perm);
    if (!ok) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }
  if (body.points !== undefined) {
    const ok = event.committeeId
      ? canLogMinutes(perm, event.committeeId)
      : canViewAllCommittees(perm);
    if (!ok) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (body.points !== undefined) {
      await tx.minutePoint.deleteMany({ where: { meetingId: meeting.id } });
      if (body.points.length > 0) {
        await tx.minutePoint.createMany({
          data: body.points.map((content, i) => ({
            meetingId: meeting.id,
            content,
            order: i + 1,
          })),
        });
      }
    }

    return tx.meeting.update({
      where: { id: meeting.id },
      data: {
        ...(body.approved !== undefined && { approved: body.approved }),
      },
      include: {
        minutes: { orderBy: { order: "asc" } },
        attendances: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });
  });

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    approved: updated.approved,
    minutes: updated.minutes,
    attendances: updated.attendances.map((a) => ({
      user: a.user,
      status: a.status,
    })),
  });
}
