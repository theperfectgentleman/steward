import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidEmail, normalizeEmail } from "@/lib/identity";
import { hashPassword, validatePassword } from "@/lib/password";
import { clearActiveOrgCookie, setSessionCookie, toSessionPayload } from "@/lib/session";
import { listUserOrganizations } from "@/lib/organizations";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
  };

  const name = body.name?.trim();
  const email = body.email ? normalizeEmail(body.email) : "";
  const password = body.password ?? "";

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
    },
    include: {
      platformAdmin: true,
      organizationMemberships: { include: { organization: true } },
      committeeMemberships: true,
      supervisoryMemberships: true,
    },
  });

  const memberships = await listUserOrganizations(user.id);
  const payload = {
    ...toSessionPayload({
      ...user,
      isPlatformAdmin: false,
      orgContext: null,
      supervisoryMemberships: [],
    }),
    memberships,
    activeOrganizationId: null,
    organization: null,
    committeeIds: [],
    committeeMemberships: [],
    supervisoryMembership: null,
  };

  const response = NextResponse.json(payload, { status: 201 });
  setSessionCookie(response, user.id);
  clearActiveOrgCookie(response);
  return response;
}
