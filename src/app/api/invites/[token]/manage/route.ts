import { NextResponse } from "next/server";
import { asPermissionUser, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { absoluteUrl, invitePath } from "@/lib/navigation";
import { sendInviteEmail } from "@/lib/notify/email";
import { sendInviteSms } from "@/lib/notify/sms";
import { canInviteMembers } from "@/lib/types";
import { INVITE_TTL_MS } from "@/lib/otp";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const { token } = await params;
  const body = (await request.json()) as { action?: "resend" | "revoke" };

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      user: true,
      committee: true,
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const perm = asPermissionUser(auth.user);
  if (!canInviteMembers(perm, invite.committeeId)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  if (body.action === "revoke") {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { revokedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "resend") {
    const updated = await prisma.invite.update({
      where: { id: invite.id },
      data: {
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        revokedAt: null,
      },
    });

    const origin = new URL(request.url).origin;
    const inviteUrl = absoluteUrl(invitePath(token), origin);

    await sendInviteEmail({
      to: invite.user.email,
      name: invite.user.name,
      committeeName: invite.committee.name,
      inviteUrl,
    });
    if (invite.user.phone) {
      await sendInviteSms({
        to: invite.user.phone,
        committeeName: invite.committee.name,
        inviteUrl,
      });
    }

    return NextResponse.json({ ok: true, expiresAt: updated.expiresAt, inviteUrl });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
