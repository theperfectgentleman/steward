import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;

  const admins = await prisma.platformAdmin.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(admins);
}

export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    userId?: string;
    email?: string;
    action?: "add" | "remove";
  };

  let userId = body.userId;
  if (!userId && body.email) {
    const user = await prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    userId = user.id;
  }
  if (!userId) {
    return NextResponse.json({ error: "userId or email required" }, { status: 400 });
  }

  if (body.action === "remove") {
    if (userId === auth.user.id) {
      return NextResponse.json(
        { error: "Cannot remove yourself" },
        { status: 400 },
      );
    }
    await prisma.platformAdmin.deleteMany({ where: { userId } });
    return NextResponse.json({ ok: true });
  }

  await prisma.platformAdmin.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
