import { NextResponse } from "next/server";
import { asPermissionUser, requireUser } from "@/lib/auth";
import { createMemberInvite } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { canInviteMembers } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  if (!committeeId) {
    return NextResponse.json({ error: "committeeId required" }, { status: 400 });
  }

  const perm = asPermissionUser(auth.user);
  if (!canInviteMembers(perm, committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({
    where: { committeeId, revokedAt: null },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, status: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(invites);
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    committeeId?: string;
    title?: "CHAIR" | "SECRETARY" | "MEMBER";
    sendNotifications?: boolean;
  };

  if (!body.name || !body.email || !body.committeeId || !body.title) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const perm = asPermissionUser(auth.user);
  if (!canInviteMembers(perm, body.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  try {
    const origin = new URL(request.url).origin;
    const result = await createMemberInvite({
      name: body.name,
      email: body.email,
      phone: body.phone,
      committeeId: body.committeeId,
      title: body.title,
      createdById: auth.user.id,
      origin,
      sendNotifications: body.sendNotifications ?? true,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create invite" },
      { status: 400 },
    );
  }
}
