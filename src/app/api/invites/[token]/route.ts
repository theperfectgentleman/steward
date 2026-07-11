import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maskEmail, maskPhone } from "@/lib/identity";

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

  return NextResponse.json({
    token: invite.token,
    userId: invite.user.id,
    name: invite.user.name,
    email: maskEmail(invite.user.email),
    phone: invite.user.phone ? maskPhone(invite.user.phone) : null,
    emailRaw: invite.user.email,
    phoneRaw: invite.user.phone,
    committee: invite.committee,
    expiresAt: invite.expiresAt,
  });
}
