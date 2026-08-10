import { prisma } from "@/lib/prisma";

export type MeetingPayload = {
  id: string;
  title: string;
  approved: boolean;
  minutes: { id: string; content: string; order: number }[];
  attendances: {
    user: { id: string; name: string };
    status: "PRESENT" | "EXCUSED" | "ABSENT" | "UNMARKED";
  }[];
};

const meetingInclude = {
  minutes: { orderBy: { order: "asc" as const } },
  attendances: {
    include: { user: { select: { id: true, name: true } } },
  },
};

/** Ensure a Meeting row exists for a MEETING-kind Event (legacy bridge). */
export async function ensureMeetingForEvent(eventId: string): Promise<MeetingPayload | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      committee: { select: { id: true, name: true, organizationId: true } },
    },
  });
  if (!event || event.kind !== "MEETING" || !event.committeeId) return null;

  let meeting = await prisma.meeting.findUnique({
    where: { eventId },
    include: meetingInclude,
  });

  if (!meeting) {
    const roster = await prisma.committeeMember.findMany({
      where: { committeeId: event.committeeId },
      select: { userId: true },
    });
    const creatorId =
      roster.find((m) => m.userId)?.userId ??
      (
        await prisma.user.findFirst({
          where: {
            organizationMemberships: {
              some: { organizationId: event.committee?.organizationId ?? "" },
            },
          },
          select: { id: true },
        })
      )?.id;
    if (!creatorId) return null;

    meeting = await prisma.meeting.create({
      data: {
        title: event.title,
        date: event.startDate,
        committeeId: event.committeeId,
        eventId: event.id,
        createdById: creatorId,
        attendances: {
          create: roster.map((m) => ({
            userId: m.userId,
            status: "UNMARKED",
          })),
        },
      },
      include: meetingInclude,
    });
  }

  return {
    id: meeting.id,
    title: meeting.title,
    approved: meeting.approved,
    minutes: meeting.minutes,
    attendances: meeting.attendances.map((a) => ({
      user: a.user,
      status: a.status,
    })),
  };
}

export async function getMeetingForEvent(eventId: string): Promise<MeetingPayload | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { eventId },
    include: meetingInclude,
  });
  if (!meeting) return null;
  return {
    id: meeting.id,
    title: meeting.title,
    approved: meeting.approved,
    minutes: meeting.minutes,
    attendances: meeting.attendances.map((a) => ({
      user: a.user,
      status: a.status,
    })),
  };
}
