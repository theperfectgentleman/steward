import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maskEmail, maskPhone, isPlaceholderEmail } from "@/lib/identity";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true, status: true } },
      committee: { select: { id: true, name: true, charterLetter: true } },
      organization: { select: { id: true, name: true } },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  if (invite.revokedAt) {
    return NextResponse.json({ error: "This invite has been revoked" }, { status: 410 });
  }

  if (invite.acceptedAt) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
  }

  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
  }

  const emailRaw = isPlaceholderEmail(invite.user.email)
    ? ""
    : invite.user.email;

  return NextResponse.json({
    token: invite.token,
    userId: invite.user.id,
    name: invite.user.name,
    email: emailRaw ? maskEmail(invite.user.email) : "",
    phone: invite.user.phone ? maskPhone(invite.user.phone) : null,
    emailRaw,
    phoneRaw: invite.user.phone,
    organizationId: invite.organizationId,
    organizationName: invite.organization.name,
    targetType: invite.targetType,
    committee: invite.committee,
    expiresAt: invite.expiresAt,
  });
}
