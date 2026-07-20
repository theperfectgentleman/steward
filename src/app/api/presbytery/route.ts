import { NextResponse } from "next/server";
import { asPermissionUser, requireActiveOrg, requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageSupervisoryRoster } from "@/lib/types";

async function getOrCreateGroup(organizationId: string, label: string) {
  let group = await prisma.supervisoryGroup.findFirst({
    where: { organizationId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
        orderBy: [{ isHead: "desc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!group) {
    group = await prisma.supervisoryGroup.create({
      data: { name: label, organizationId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
      },
    });
  }

  return group;
}

export async function GET() {
  const auth = await requireActiveOrg();
  if (auth.error) return auth.error;

  const group = await getOrCreateGroup(
    auth.org.organizationId,
    auth.org.settings.supervisoryLabel,
  );
  return NextResponse.json(group);
}

export async function POST(request: Request) {
  const auth = await requireRoles(["ORG_ADMIN", "ORG_TECH"]);
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  if (!canManageSupervisoryRoster(perm)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const orgId = auth.user.orgContext!.organizationId;
  const label =
    auth.user.orgContext!.settings.supervisoryLabel || "Supervisory Group";

  const body = (await request.json()) as {
    userId?: string;
    isHead?: boolean;
    action?: "add" | "remove" | "set_head";
  };

  const group = await getOrCreateGroup(orgId, label);

  if (body.action === "remove" && body.userId) {
    await prisma.supervisoryMember.deleteMany({
      where: { userId: body.userId, groupId: group.id },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_head" && body.userId) {
    await prisma.supervisoryMember.updateMany({
      where: { groupId: group.id },
      data: { isHead: false },
    });
    await prisma.supervisoryMember.updateMany({
      where: { userId: body.userId, groupId: group.id },
      data: { isHead: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  await prisma.supervisoryMember.upsert({
    where: {
      userId_groupId: { userId: body.userId, groupId: group.id },
    },
    create: {
      userId: body.userId,
      groupId: group.id,
      isHead: body.isHead ?? false,
    },
    update: { isHead: body.isHead ?? false },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
