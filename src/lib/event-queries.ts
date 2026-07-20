import { computeEventProgress } from "@/lib/event-progress";
import { prisma } from "@/lib/prisma";

export async function getEventWithProgress(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      committee: { select: { name: true, charterLetter: true } },
      rsvps: {
        include: { user: { select: { id: true, name: true } } },
      },
      tasks: {
        include: {
          assignedTo: { select: { id: true, name: true } },
          subtasks: {
            include: {
              assignedTo: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
        where: { parentId: null },
        orderBy: { createdAt: "asc" },
      },
      deliverables: {
        include: {
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      agendaItems: {
        orderBy: { order: "asc" },
        include: {
          assignment: { select: { id: true, title: true } },
        },
      },
      meeting: {
        include: {
          minutes: { orderBy: { order: "asc" } },
          attendances: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  if (!event) return null;

  const allTasks = await prisma.task.findMany({
    where: { eventId },
    select: { id: true, status: true, parentId: true },
  });

  const { progress, doneCount, totalCount } = computeEventProgress(allTasks);

  return {
    ...event,
    progress,
    doneCount,
    totalCount,
  };
}

export async function enrichEventsWithProgress(
  events: Awaited<ReturnType<typeof prisma.event.findMany>>,
) {
  if (events.length === 0) return [];

  const eventIds = events.map((e) => e.id);
  const allTasks = await prisma.task.findMany({
    where: { eventId: { in: eventIds } },
    select: { id: true, status: true, parentId: true, eventId: true },
  });

  return events.map((event) => {
    const eventTasks = allTasks.filter((t) => t.eventId === event.id);
    const { progress, doneCount, totalCount } = computeEventProgress(eventTasks);
    return { ...event, progress, doneCount, totalCount };
  });
}
