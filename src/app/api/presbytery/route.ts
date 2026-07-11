import { NextResponse } from "next/server";
import { asPermissionUser, requireRoles } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManagePresbyteryRoster } from "@/lib/types";

export async function GET() {
  const auth = await requireRoles(["SUPER_ADMIN", "SYSTEM_ADMIN", "CHURCH_EXECUTIVE"]);
  if (auth.error) return auth.error;

  let group = await prisma.presbyteryGroup.findFirst({
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
    group = await prisma.presbyteryGroup.create({
      data: { name: "Presbytery" },
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

  return NextResponse.json(group);
}

export async function POST(request: Request) {
  const auth = await requireRoles(["SUPER_ADMIN", "SYSTEM_ADMIN"]);
  if (auth.error) return auth.error;

  const perm = asPermissionUser(auth.user);
  if (!canManagePresbyteryRoster(perm.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = (await request.json()) as {
    userId?: string;
    isHead?: boolean;
    action?: "add" | "remove" | "set_head";
  };

  let group = await prisma.presbyteryGroup.findFirst();
  if (!group) {
    group = await prisma.presbyteryGroup.create({ data: { name: "Presbytery" } });
  }

  if (body.action === "remove" && body.userId) {
    await prisma.presbyteryMember.deleteMany({ where: { userId: body.userId } });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_head" && body.userId) {
    await prisma.presbyteryMember.updateMany({
      where: { groupId: group.id },
      data: { isHead: false },
    });
    await prisma.presbyteryMember.updateMany({
      where: { userId: body.userId, groupId: group.id },
      data: { isHead: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: body.userId },
    data: { role: "CHURCH_EXECUTIVE" },
  });

  await prisma.presbyteryMember.upsert({
    where: { userId: body.userId },
    create: {
      userId: body.userId,
      groupId: group.id,
      isHead: body.isHead ?? false,
    },
    update: { isHead: body.isHead ?? false },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
