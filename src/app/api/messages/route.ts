import { NextResponse } from "next/server";
import { requireActiveOrg } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MessageThreadKind } from "@/lib/types";

function isThreadKind(value: unknown): value is MessageThreadKind {
  return value === "DIRECT" || value === "COMMITTEE" || value === "GROUP";
}

export async function GET() {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const userId = auth.user.id;
  const orgId = auth.org.organizationId;

  const participations = await prisma.messageParticipant.findMany({
    where: {
      userId,
      thread: { organizationId: orgId },
    },
    include: {
      thread: {
        include: {
          committee: { select: { id: true, name: true, charterLetter: true } },
          participants: {
            include: { user: { select: { id: true, name: true } } },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { thread: { updatedAt: "desc" } },
  });

  const threads = participations.map((p) => {
    const lastMessage = p.thread.messages[0] ?? null;
    const unread =
      !!lastMessage &&
      lastMessage.senderId !== userId &&
      (!p.lastReadAt || lastMessage.createdAt > p.lastReadAt);

    return {
      id: p.thread.id,
      kind: p.thread.kind,
      subject: p.thread.subject,
      committeeId: p.thread.committeeId,
      committee: p.thread.committee,
      createdById: p.thread.createdById,
      createdAt: p.thread.createdAt,
      updatedAt: p.thread.updatedAt,
      participants: p.thread.participants.map((part) => ({
        id: part.user.id,
        name: part.user.name,
        lastReadAt: part.lastReadAt,
      })),
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            body: lastMessage.body,
            createdAt: lastMessage.createdAt,
            sender: lastMessage.sender,
          }
        : null,
      unread,
      lastReadAt: p.lastReadAt,
    };
  });

  return NextResponse.json(threads);
}

export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const userId = auth.user.id;
  const orgId = auth.org.organizationId;
  const body = (await request.json()) as {
    kind?: MessageThreadKind;
    subject?: string;
    committeeId?: string;
    participantUserIds?: string[];
    body?: string;
  };

  if (!isThreadKind(body.kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const participantIds = new Set<string>([userId]);

  if (body.kind === "COMMITTEE") {
    if (!body.committeeId) {
      return NextResponse.json(
        { error: "committeeId required for committee threads" },
        { status: 400 },
      );
    }

    const committee = await prisma.committee.findFirst({
      where: { id: body.committeeId, organizationId: orgId },
      include: { members: { select: { userId: true } } },
    });

    if (!committee) {
      return NextResponse.json({ error: "Committee not found" }, { status: 404 });
    }

    for (const member of committee.members) {
      participantIds.add(member.userId);
    }
  } else {
    for (const id of body.participantUserIds ?? []) {
      if (typeof id === "string" && id.trim()) participantIds.add(id.trim());
    }

    if (body.kind === "DIRECT" && participantIds.size < 2) {
      return NextResponse.json(
        { error: "At least one other participant is required" },
        { status: 400 },
      );
    }
  }

  // Ensure all participants belong to the active org
  const orgMembers = await prisma.organizationMembership.findMany({
    where: {
      organizationId: orgId,
      userId: { in: [...participantIds] },
    },
    select: { userId: true },
  });
  const validIds = new Set(orgMembers.map((m) => m.userId));
  validIds.add(userId);

  const finalParticipantIds = [...participantIds].filter((id) => validIds.has(id));
  if (finalParticipantIds.length < 1) {
    return NextResponse.json({ error: "No valid participants" }, { status: 400 });
  }

  const initialBody = body.body?.trim();
  const now = new Date();

  const thread = await prisma.messageThread.create({
    data: {
      organizationId: orgId,
      kind: body.kind,
      subject: body.subject?.trim() || null,
      committeeId: body.kind === "COMMITTEE" ? body.committeeId! : null,
      createdById: userId,
      participants: {
        create: finalParticipantIds.map((id) => ({
          userId: id,
          lastReadAt: id === userId ? now : null,
        })),
      },
      ...(initialBody
        ? {
            messages: {
              create: {
                senderId: userId,
                body: initialBody,
              },
            },
          }
        : {}),
    },
    include: {
      committee: { select: { id: true, name: true, charterLetter: true } },
      participants: {
        include: { user: { select: { id: true, name: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json(
    {
      id: thread.id,
      kind: thread.kind,
      subject: thread.subject,
      committeeId: thread.committeeId,
      committee: thread.committee,
      createdById: thread.createdById,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      participants: thread.participants.map((p) => ({
        id: p.user.id,
        name: p.user.name,
        lastReadAt: p.lastReadAt,
      })),
      lastMessage: thread.messages[0]
        ? {
            id: thread.messages[0].id,
            body: thread.messages[0].body,
            createdAt: thread.messages[0].createdAt,
            sender: thread.messages[0].sender,
          }
        : null,
      unread: false,
    },
    { status: 201 },
  );
}
