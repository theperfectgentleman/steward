import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateOtpCode,
  hashOtp,
  MAX_OTP_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  verifyOtp,
} from "@/lib/otp";
import { maskEmail, maskPhone } from "@/lib/identity";
import { sendOtpEmail } from "@/lib/notify/email";
import { sendOtpSms } from "@/lib/notify/sms";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    userId?: string;
    channel?: "EMAIL" | "SMS";
    purpose?: "INVITE" | "LOGIN_RESET";
    inviteToken?: string;
  };

  if (!body.userId || !body.channel || !body.purpose) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: body.userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (body.purpose === "INVITE" && body.inviteToken) {
    const invite = await prisma.invite.findUnique({
      where: { token: body.inviteToken },
    });
    if (
      !invite ||
      invite.userId !== user.id ||
      invite.revokedAt ||
      invite.acceptedAt ||
      invite.expiresAt < new Date()
    ) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
    }
  }

  const recent = await prisma.otpChallenge.findFirst({
    where: {
      userId: user.id,
      purpose: body.purpose,
      consumedAt: null,
      createdAt: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recent) {
    return NextResponse.json(
      { error: "Please wait a minute before requesting another code" },
      { status: 429 },
    );
  }

  const destination =
    body.channel === "EMAIL"
      ? user.email
      : user.phone;

  if (!destination) {
    return NextResponse.json(
      { error: body.channel === "SMS" ? "No phone on file" : "No email on file" },
      { status: 400 },
    );
  }

  const code = generateOtpCode();
  const codeHash = await hashOtp(code);

  await prisma.otpChallenge.create({
    data: {
      userId: user.id,
      channel: body.channel,
      destination,
      codeHash,
      purpose: body.purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  if (body.channel === "EMAIL") {
    await sendOtpEmail({ to: destination, name: user.name, code });
  } else {
    await sendOtpSms({ to: destination, code });
  }

  return NextResponse.json({
    ok: true,
    maskedDestination:
      body.channel === "EMAIL"
        ? maskEmail(destination)
        : maskPhone(destination),
  });
}
