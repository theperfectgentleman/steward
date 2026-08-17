import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizePhone } from "@/lib/identity";
import { issueOtpChallenge, OtpSendError } from "@/lib/otp-send";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    identifier?: string;
    channel?: "EMAIL" | "SMS";
  };

  const identifier = body.identifier?.trim();
  if (!identifier || !body.channel) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const email = normalizeEmail(identifier);
  const phone = normalizePhone(identifier);

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone: identifier }, { phone }],
      status: "ACTIVE",
    },
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { error: "If an account exists, a code will be sent" },
      { status: 200 },
    );
  }

  const destination = body.channel === "EMAIL" ? user.email : user.phone;
  if (!destination) {
    return NextResponse.json(
      { error: body.channel === "SMS" ? "No phone on file" : "No email on file" },
      { status: 400 },
    );
  }

  try {
    const sent = await issueOtpChallenge({
      userId: user.id,
      channel: body.channel,
      purpose: "LOGIN_RESET",
    });

    return NextResponse.json({
      userId: user.id,
      maskedDestination: sent.maskedDestination,
    });
  } catch (e) {
    if (e instanceof OtpSendError) {
      if (e.status === 429) {
        return NextResponse.json({ error: e.message }, { status: 429 });
      }
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
