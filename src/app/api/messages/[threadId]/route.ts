import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getParticipantThread(
  threadId: string,
  userId: string,
  orgId: string,
) {
  return prisma.messageParticipant.findFirst({
    where: {
      threadId,
      userId,
      thread: { organizationId: orgId },
    },
    include: {
      thread: {
        include: {
          committee: { select: { id: true, name: true, charterLetter: true } },
        },
      },
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { threadId } = await params;
  const participation = await getParticipantThread(
    threadId,
    auth.user.id,
    auth.org.organizationId,
  );

  if (!participation) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const [messages, participants] = await Promise.all([
    prisma.message.findMany({
      where: { threadId },
      include: { sender: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.messageParticipant.findMany({
      where: { threadId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "asc" },
    }),
  ]);

  return NextResponse.json({
    id: participation.thread.id,
    kind: participation.thread.kind,
    subject: participation.thread.subject,
    committeeId: participation.thread.committeeId,
    committee: participation.thread.committee,
    createdById: participation.thread.createdById,
    createdAt: participation.thread.createdAt,
    updatedAt: participation.thread.updatedAt,
    lastReadAt: participation.lastReadAt,
    participants: participants.map((p) => ({
      id: p.user.id,
      name: p.user.name,
      lastReadAt: p.lastReadAt,
      joinedAt: p.joinedAt,
    })),
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      sender: m.sender,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { threadId } = await params;
  const participation = await getParticipantThread(
    threadId,
    auth.user.id,
    auth.org.organizationId,
  );

  if (!participation) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const body = (await request.json()) as { body?: string };
  const text = body.body?.trim();
  if (!text) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const now = new Date();

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        threadId,
        senderId: auth.user.id,
        body: text,
      },
      include: { sender: { select: { id: true, name: true } } },
    }),
    prisma.messageThread.update({
      where: { id: threadId },
      data: { updatedAt: now },
    }),
    prisma.messageParticipant.update({
      where: {
        threadId_userId: { threadId, userId: auth.user.id },
      },
      data: { lastReadAt: now },
    }),
  ]);

  return NextResponse.json(
    {
      id: message.id,
      body: message.body,
      createdAt: message.createdAt,
      sender: message.sender,
    },
    { status: 201 },
  );
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const { threadId } = await params;
  const participation = await getParticipantThread(
    threadId,
    auth.user.id,
    auth.org.organizationId,
  );

  if (!participation) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const updated = await prisma.messageParticipant.update({
    where: {
      threadId_userId: { threadId, userId: auth.user.id },
    },
    data: { lastReadAt: new Date() },
  });

  return NextResponse.json({ lastReadAt: updated.lastReadAt });
}
