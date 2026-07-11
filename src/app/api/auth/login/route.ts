import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizePhone } from "@/lib/identity";
import { verifyPassword } from "@/lib/password";
import { setSessionCookie, toSessionPayload } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    identifier?: string;
    password?: string;
  };

  const identifier = body.identifier?.trim();
  const password = body.password;

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "Email or phone and password are required" },
      { status: 400 },
    );
  }

  const email = normalizeEmail(identifier);
  const phone = normalizePhone(identifier);

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone: identifier }, { phone }],
    },
    include: {
      committeeMemberships: true,
      presbyteryMembership: true,
    },
  });

  if (!user || user.status !== "ACTIVE" || !user.passwordHash) {
    return NextResponse.json(
      { error: "Invalid email/phone or password" },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid email/phone or password" },
      { status: 401 },
    );
  }

  const payload = toSessionPayload(user);
  const response = NextResponse.json(payload);
  setSessionCookie(response, user.id);
  return response;
}
