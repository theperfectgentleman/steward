import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  countUrls,
  FEEDBACK_LIMITS,
  normalizeMessage,
  type FeedbackType,
} from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
import { canEditTasks, canViewAllCommittees } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const mine = searchParams.get("mine") === "true";

  if (mine) {
    const items = await prisma.committeeFeedback.findMany({
      where: { userId: user.id },
      include: {
        committee: { select: { name: true, charterLetter: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    return NextResponse.json(items);
  }

  const canReview =
    canViewAllCommittees(user.role) || canEditTasks(user.role);

  if (!canReview) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const where = committeeId
    ? { committeeId }
    : canViewAllCommittees(user.role)
      ? {}
      : {
          committeeId: {
            in: user.committeeMemberships.map((m) => m.committeeId),
          },
        };

  const items = await prisma.committeeFeedback.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      committee: { select: { name: true, charterLetter: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = (await request.json()) as {
    committeeId?: string;
    type?: FeedbackType;
    message?: string;
    website?: string;
  };

  if (body.website) {
    return NextResponse.json({ error: "Submission rejected" }, { status: 400 });
  }

  const committeeId = body.committeeId?.trim();
  const type = body.type;
  const message = normalizeMessage(body.message ?? "");

  if (!committeeId || !type || !message) {
    return NextResponse.json(
      { error: "Committee, type, and message are required" },
      { status: 400 },
    );
  }

  if (type !== "ISSUE" && type !== "SUGGESTION") {
    return NextResponse.json({ error: "Invalid feedback type" }, { status: 400 });
  }

  if (message.length < FEEDBACK_LIMITS.minMessageLength) {
    return NextResponse.json(
      {
        error: `Please write at least ${FEEDBACK_LIMITS.minMessageLength} characters`,
      },
      { status: 400 },
    );
  }

  if (message.length > FEEDBACK_LIMITS.maxMessageLength) {
    return NextResponse.json(
      {
        error: `Message must be under ${FEEDBACK_LIMITS.maxMessageLength} characters`,
      },
      { status: 400 },
    );
  }

  if (countUrls(message) > FEEDBACK_LIMITS.maxUrls) {
    return NextResponse.json(
      { error: "Too many links in message" },
      { status: 400 },
    );
  }

  const committee = await prisma.committee.findUnique({
    where: { id: committeeId },
  });
  if (!committee) {
    return NextResponse.json({ error: "Committee not found" }, { status: 404 });
  }

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const cooldownAgo = new Date(now - FEEDBACK_LIMITS.cooldownSeconds * 1000);
  const duplicateAgo = new Date(
    now - FEEDBACK_LIMITS.duplicateWindowSeconds * 1000,
  );

  const [recentAny, recentForCommittee, duplicate] = await Promise.all([
    prisma.committeeFeedback.findFirst({
      where: { userId: user.id, createdAt: { gte: cooldownAgo } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.committeeFeedback.count({
      where: {
        userId: user.id,
        committeeId,
        createdAt: { gte: dayAgo },
      },
    }),
    prisma.committeeFeedback.findFirst({
      where: {
        userId: user.id,
        message,
        createdAt: { gte: duplicateAgo },
      },
    }),
  ]);

  if (recentAny) {
    const waitMinutes = Math.ceil(
      (recentAny.createdAt.getTime() +
        FEEDBACK_LIMITS.cooldownSeconds * 1000 -
        now) /
        60000,
    );
    return NextResponse.json(
      {
        error: `Please wait ${Math.max(waitMinutes, 1)} minute(s) before submitting again`,
      },
      { status: 429 },
    );
  }

  if (recentForCommittee >= FEEDBACK_LIMITS.maxPerCommitteePerDay) {
    return NextResponse.json(
      {
        error: `Daily limit reached (${FEEDBACK_LIMITS.maxPerCommitteePerDay} per committee). Try again tomorrow.`,
      },
      { status: 429 },
    );
  }

  if (duplicate) {
    return NextResponse.json(
      { error: "You already submitted this message recently" },
      { status: 409 },
    );
  }

  const feedback = await prisma.committeeFeedback.create({
    data: {
      userId: user.id,
      committeeId,
      type,
      message,
    },
    include: {
      committee: { select: { name: true, charterLetter: true } },
    },
  });

  return NextResponse.json(feedback, { status: 201 });
}
