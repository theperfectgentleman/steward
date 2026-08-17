import { NextResponse } from "next/server";
import { asPermissionUser, requireActiveOrg } from "@/lib/auth";
import { createMemberInvite, createSupervisoryInvite } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { canInviteMembers, type SupervisoryTitle } from "@/lib/types";

const SUPERVISORY_TITLES: SupervisoryTitle[] = [
  "HEAD",
  "SECRETARY",
  "MEMBER",
  "CUSTOM",
];

export async function GET(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  if (!canInviteMembers(perm)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const committeeId = searchParams.get("committeeId");
  const targetType = searchParams.get("targetType");

  const invites = await prisma.invite.findMany({
    where: {
      organizationId: auth.org.organizationId,
      revokedAt: null,
      ...(committeeId ? { committeeId } : {}),
      ...(targetType === "SUPERVISORY" ? { targetType: "SUPERVISORY" } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, status: true } },
      createdBy: { select: { id: true, name: true } },
      committee: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(invites);
}

export async function POST(request: Request) {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  if (!canInviteMembers(perm)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    committeeId?: string;
    title?: "CHAIR" | "SECRETARY" | "MEMBER";
    targetType?: "COMMITTEE" | "SUPERVISORY";
    supervisoryTitle?: SupervisoryTitle;
    sendNotifications?: boolean;
  };

  if (!body.name || !body.email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  try {
    if (body.targetType === "SUPERVISORY") {
      const title = SUPERVISORY_TITLES.includes(body.supervisoryTitle ?? "MEMBER")
        ? (body.supervisoryTitle ?? "MEMBER")
        : "MEMBER";
      const result = await createSupervisoryInvite({
        name: body.name,
        email: body.email,
        phone: body.phone,
        organizationId: auth.org.organizationId,
        title,
        createdById: auth.user.id,
        origin,
        sendNotifications: body.sendNotifications ?? true,
      });
      return NextResponse.json(result);
    }

    if (!body.committeeId || !body.title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const committee = await prisma.committee.findFirst({
      where: {
        id: body.committeeId,
        organizationId: auth.org.organizationId,
      },
    });
    if (!committee) {
      return NextResponse.json({ error: "Committee not found" }, { status: 404 });
    }

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
