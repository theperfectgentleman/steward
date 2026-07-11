import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_OTP_ATTEMPTS, verifyOtp } from "@/lib/otp";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    userId?: string;
    code?: string;
    purpose?: "INVITE" | "LOGIN_RESET";
  };

  if (!body.userId || !body.code || !body.purpose) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      userId: body.userId,
      purpose: body.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) {
    return NextResponse.json({ error: "Code expired or not found" }, { status: 400 });
  }

  if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  const valid = await verifyOtp(body.code.trim(), challenge.codeHash);
  if (!valid) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
