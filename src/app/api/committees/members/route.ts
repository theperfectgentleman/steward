import { NextResponse } from "next/server";
import {
  assertCommitteeAccess,
  requireRoles,
  requireUser,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");

  if (!committeeId) {
    return NextResponse.json({ error: "committeeId required" }, { status: 400 });
  }

  const access = assertCommitteeAccess(auth.user, committeeId);
  if (access) return access;

  const members = await prisma.committeeMember.findMany({
    where: { committeeId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { title: "asc" },
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.user.role,
      title: m.title,
      membershipId: m.id,
    })),
  );
}

export async function POST(request: Request) {
  const auth = await requireRoles(["SUPER_ADMIN", "SYSTEM_ADMIN"]);
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    userId?: string;
    committeeId?: string;
    title?: "CHAIR" | "SECRETARY" | "MEMBER";
  };

  if (!body.userId || !body.committeeId || !body.title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const membership = await prisma.committeeMember.upsert({
    where: {
      userId_committeeId: {
        userId: body.userId,
        committeeId: body.committeeId,
      },
    },
    create: {
      userId: body.userId,
      committeeId: body.committeeId,
      title: body.title,
    },
    update: { title: body.title },
  });

  return NextResponse.json(membership);
}
