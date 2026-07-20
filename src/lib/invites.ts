import { prisma } from "@/lib/prisma";
import {
  generateInviteToken,
  INVITE_TTL_MS,
} from "@/lib/otp";
import {
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
} from "@/lib/identity";
import { absoluteUrl, invitePath } from "@/lib/navigation";
import { sendInviteEmail, sendAddedToCommitteeEmail } from "@/lib/notify/email";
import { sendInviteSms, sendAddedToCommitteeSms } from "@/lib/notify/sms";
import type { CommitteeTitle } from "@/lib/types";

type CreateInviteInput = {
  name: string;
  email: string;
  phone?: string;
  committeeId: string;
  title: CommitteeTitle;
  createdById: string;
  origin: string;
  sendNotifications?: boolean;
};

export async function createMemberInvite(input: CreateInviteInput) {
  const email = normalizeEmail(input.email);
  const phone = input.phone ? normalizePhone(input.phone) : null;

  if (!isValidEmail(email)) {
    throw new Error("Invalid email address");
  }
  if (input.sendNotifications && phone && !isValidPhone(phone)) {
    throw new Error("Invalid phone number for SMS");
  }

  const committee = await prisma.committee.findUnique({
    where: { id: input.committeeId },
  });
  if (!committee) throw new Error("Committee not found");

  const organizationId = committee.organizationId;

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { committeeMemberships: true },
  });

  const loginUrl = absoluteUrl("/", input.origin);

  if (existing?.status === "ACTIVE" && existing.passwordHash) {
    await prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: existing.id,
        },
      },
      create: {
        organizationId,
        userId: existing.id,
        role: "ORG_PARTICIPANT",
      },
      update: {},
    });

    await prisma.committeeMember.upsert({
      where: {
        userId_committeeId: {
          userId: existing.id,
          committeeId: input.committeeId,
        },
      },
      create: {
        userId: existing.id,
        committeeId: input.committeeId,
        title: input.title,
      },
      update: { title: input.title },
    });

    if (input.sendNotifications) {
      await sendAddedToCommitteeEmail({
        to: email,
        name: existing.name,
        committeeName: committee.name,
        loginUrl,
      });
      if (phone || existing.phone) {
        await sendAddedToCommitteeSms({
          to: phone ?? existing.phone!,
          committeeName: committee.name,
          loginUrl,
        });
      }
    }

    return {
      type: "existing" as const,
      userId: existing.id,
      inviteUrl: null,
    };
  }

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        phone,
        status: "PENDING",
        organizationMemberships: {
          create: {
            organizationId,
            role: "ORG_PARTICIPANT",
          },
        },
      },
    }));

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: input.name.trim(),
        phone: phone ?? existing.phone,
      },
    });
    await prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: existing.id,
        },
      },
      create: {
        organizationId,
        userId: existing.id,
        role: "ORG_PARTICIPANT",
      },
      update: {},
    });
  }

  await prisma.committeeMember.upsert({
    where: {
      userId_committeeId: {
        userId: user.id,
        committeeId: input.committeeId,
      },
    },
    create: {
      userId: user.id,
      committeeId: input.committeeId,
      title: input.title,
    },
    update: { title: input.title },
  });

  await prisma.invite.updateMany({
    where: {
      userId: user.id,
      committeeId: input.committeeId,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const token = generateInviteToken();
  const invite = await prisma.invite.create({
    data: {
      token,
      organizationId,
      userId: user.id,
      committeeId: input.committeeId,
      title: input.title,
      createdById: input.createdById,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    include: {
      committee: true,
      user: true,
    },
  });

  const inviteUrl = absoluteUrl(invitePath(token), input.origin);

  if (input.sendNotifications) {
    await sendInviteEmail({
      to: email,
      name: user.name,
      committeeName: committee.name,
      inviteUrl,
    });
    if (phone) {
      await sendInviteSms({
        to: phone,
        committeeName: committee.name,
        inviteUrl,
      });
    }
  }

  return {
    type: "invite" as const,
    userId: user.id,
    inviteId: invite.id,
    token,
    inviteUrl,
    expiresAt: invite.expiresAt,
  };
}
