import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizePhone, maskEmail, maskPhone } from "@/lib/identity";

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

  const origin = new URL(request.url).origin;
  const sendRes = await fetch(`${origin}/api/auth/otp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: user.id,
      channel: body.channel,
      purpose: "LOGIN_RESET",
    }),
  });

  const data = await sendRes.json();
  if (!sendRes.ok) {
    return NextResponse.json({ error: data.error ?? "Could not send code" }, { status: sendRes.status });
  }

  return NextResponse.json({
    userId: user.id,
    maskedDestination:
      body.channel === "EMAIL"
        ? maskEmail(destination)
        : maskPhone(destination),
  });
}
