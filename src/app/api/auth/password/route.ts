import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePassword } from "@/lib/password";
import { setActiveOrgCookie, setSessionCookie, toSessionPayload } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    userId?: string;
    password?: string;
    purpose?: "INVITE" | "LOGIN_RESET";
    inviteToken?: string;
  };

  if (!body.userId || !body.password || !body.purpose) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const passwordError = validatePassword(body.password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const verified = await prisma.otpChallenge.findFirst({
    where: {
      userId: body.userId,
      purpose: body.purpose,
      consumedAt: { not: null },
      createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) },
    },
    orderBy: { consumedAt: "desc" },
  });

  if (!verified) {
    return NextResponse.json(
      { error: "Verify your code before setting a password" },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(body.password);
  const now = new Date();
  let acceptedOrganizationId: string | null = null;

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: body.userId },
      data: {
        passwordHash,
        status: "ACTIVE",
        mustChangePassword: false,
        ...(verified.channel === "EMAIL" ? { emailVerifiedAt: now } : {}),
        ...(verified.channel === "SMS" ? { phoneVerifiedAt: now } : {}),
      },
      include: {
        committeeMemberships: true,
        supervisoryMemberships: true,
        organizationMemberships: {
          include: { organization: true },
        },
        platformAdmin: true,
      },
    });

    if (body.purpose === "INVITE" && body.inviteToken) {
      const accepted = await tx.invite.updateMany({
        where: {
          token: body.inviteToken,
          userId: body.userId,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { acceptedAt: now },
      });
      if (accepted.count > 0) {
        const invite = await tx.invite.findUnique({
          where: { token: body.inviteToken },
          select: { organizationId: true },
        });
        acceptedOrganizationId = invite?.organizationId ?? null;
      }
    }

    return updated;
  });

  if (body.purpose === "INVITE") {
    const payload = toSessionPayload({
      ...user,
      mustChangePassword: false,
      isPlatformAdmin: Boolean(user.platformAdmin),
      supervisoryMemberships: user.supervisoryMemberships,
      organizationMemberships: user.organizationMemberships.map((m) => ({
        role: m.role,
        organization: {
          id: m.organization.id,
          name: m.organization.name,
          status: m.organization.status,
        },
      })),
    });
    const response = NextResponse.json({
      ...payload,
      organizationId: acceptedOrganizationId,
    });
    setSessionCookie(response, user.id);
    if (acceptedOrganizationId) {
      setActiveOrgCookie(response, acceptedOrganizationId);
    }
    return response;
  }

  return NextResponse.json({ ok: true });
}
