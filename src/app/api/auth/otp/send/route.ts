import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueOtpChallenge, OtpSendError } from "@/lib/otp-send";

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

  if (body.purpose !== "INVITE") {
    return NextResponse.json(
      { error: "Password reset codes can only be requested from Forgot password" },
      { status: 400 },
    );
  }

  if (!body.inviteToken) {
    return NextResponse.json({ error: "inviteToken required" }, { status: 400 });
  }

  const invite = await prisma.invite.findUnique({
    where: { token: body.inviteToken },
  });
  if (
    !invite ||
    invite.userId !== body.userId ||
    invite.revokedAt ||
    invite.acceptedAt ||
    invite.expiresAt < new Date()
  ) {
    return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
  }

  try {
    const result = await issueOtpChallenge({
      userId: body.userId,
      channel: body.channel,
      purpose: "INVITE",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof OtpSendError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
