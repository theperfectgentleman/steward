import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!body.currentPassword || !body.newPassword) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const passwordError = validatePassword(body.newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return NextResponse.json({ error: "No password on file" }, { status: 400 });
  }

  const valid = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      passwordHash: await hashPassword(body.newPassword),
      mustChangePassword: false,
    },
  });

  return NextResponse.json({ ok: true });
}
