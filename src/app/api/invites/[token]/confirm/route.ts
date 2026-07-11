import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
} from "@/lib/identity";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await request.json()) as {
    email?: string;
    phone?: string;
  };

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { user: true },
  });

  if (
    !invite ||
    invite.revokedAt ||
    invite.acceptedAt ||
    invite.expiresAt < new Date()
  ) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
  }

  const email = body.email ? normalizeEmail(body.email) : invite.user.email;
  const phone = body.phone ? normalizePhone(body.phone) : invite.user.phone;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (phone && !isValidPhone(phone)) {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  const emailTaken = await prisma.user.findFirst({
    where: { email, id: { not: invite.userId } },
  });
  if (emailTaken) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  await prisma.user.update({
    where: { id: invite.userId },
    data: { email, phone },
  });

  return NextResponse.json({
    ok: true,
    userId: invite.userId,
    hasEmail: true,
    hasPhone: Boolean(phone),
  });
}
