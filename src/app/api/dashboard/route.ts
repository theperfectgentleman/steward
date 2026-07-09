import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const committees = await prisma.committee.findMany({
    include: {
      tasks: { select: { status: true } },
      _count: { select: { meetings: true } },
    },
    orderBy: { charterLetter: "asc" },
  });

  const stats = committees.map((c) => {
    const total = c.tasks.length;
    const done = c.tasks.filter((t) => t.status === "DONE").length;
    const blocked = c.tasks.filter((t) => t.status === "BLOCKED").length;
    return {
      id: c.id,
      charterLetter: c.charterLetter,
      name: c.name,
      total,
      done,
      blocked,
      meetingCount: c._count.meetings,
    };
  });

  const recentTasks = await prisma.task.findMany({
    where: { status: { in: ["BLOCKED", "DONE"] } },
    include: { committee: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const pendingMinutes = await prisma.meeting.findMany({
    where: { approved: false },
    include: { committee: { select: { name: true } } },
    orderBy: { date: "desc" },
    take: 5,
  });

  const alerts = [
    ...recentTasks
      .filter((t) => t.status === "BLOCKED")
      .map((t) => ({
        id: `blocked-${t.id}`,
        type: "blocked" as const,
        message: `${t.committee.name}: ${t.title} is blocked`,
        time: t.updatedAt.toISOString(),
      })),
    ...recentTasks
      .filter((t) => t.status === "DONE")
      .slice(0, 3)
      .map((t) => ({
        id: `done-${t.id}`,
        type: "completed" as const,
        message: `${t.committee.name} completed ${t.title}`,
        time: t.updatedAt.toISOString(),
      })),
    ...pendingMinutes.map((m) => ({
      id: `minutes-${m.id}`,
      type: "minutes" as const,
      message: `${m.committee.name} minutes filed — pending review`,
      time: m.date.toISOString(),
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return NextResponse.json({ stats, alerts });
}
