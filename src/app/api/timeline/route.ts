import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  assertCommitteeMutation,
  asPermissionUser,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditTasks, canViewAllCommittees } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");

  if (committeeId) {
    const access = assertCommitteeAccess(auth.user, committeeId);
    if (access) return access;
  } else if (!canViewAllCommittees(perm)) {
    return NextResponse.json({ error: "committeeId required" }, { status: 400 });
  }

  const goals = await prisma.timelineGoal.findMany({
    where: committeeId
      ? { committeeId }
      : canViewAllCommittees(perm)
        ? undefined
        : {
            committeeId: {
              in: auth.user.committeeMemberships.map((m) => m.committeeId),
            },
          },
    include: { committee: { select: { name: true, charterLetter: true } } },
    orderBy: { startDate: "asc" },
  });

  return NextResponse.json(goals);
}

export async function PATCH(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    id?: string;
    progress?: number;
    startDate?: string;
    endDate?: string;
    title?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.timelineGoal.findUnique({
    where: { id: body.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  const mutation = assertCommitteeMutation(auth.user, existing.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, existing.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, existing.committeeId);
  if (access) return access;

  if (
    body.progress !== undefined &&
    (body.progress < 0 || body.progress > 100)
  ) {
    return NextResponse.json(
      { error: "progress must be 0–100" },
      { status: 400 },
    );
  }

  const goal = await prisma.timelineGoal.update({
    where: { id: body.id },
    data: {
      ...(body.progress !== undefined && { progress: body.progress }),
      ...(body.startDate && { startDate: new Date(body.startDate) }),
      ...(body.endDate && { endDate: new Date(body.endDate) }),
      ...(body.title && { title: body.title }),
    },
    include: { committee: { select: { name: true, charterLetter: true } } },
  });

  return NextResponse.json(goal);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    title?: string;
    startDate?: string;
    endDate?: string;
    committeeId?: string;
    progress?: number;
  };

  if (!body.title || !body.startDate || !body.endDate || !body.committeeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const mutation = assertCommitteeMutation(auth.user, body.committeeId);
  if (mutation) return mutation;

  const perm = asPermissionUser(auth.user);
  if (!canEditTasks(perm, body.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const access = assertCommitteeAccess(auth.user, body.committeeId);
  if (access) return access;

  const goal = await prisma.timelineGoal.create({
    data: {
      title: body.title,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      committeeId: body.committeeId,
      progress: body.progress ?? 0,
    },
    include: { committee: { select: { name: true, charterLetter: true } } },
  });

  return NextResponse.json(goal, { status: 201 });
}
