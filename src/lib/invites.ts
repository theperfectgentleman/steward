import { prisma } from "@/lib/prisma";
import {
  generateInviteToken,
  INVITE_TTL_MS,
} from "@/lib/otp";
import type {
  CommitteeTitle,
  OrganizationMemberRole,
  SupervisoryTitle,
} from "@/lib/types";
import { logActivity } from "@/lib/activity";
import { supervisoryTitleTemplateKey } from "@/lib/role-capabilities";
import {
  isValidEmail,
  isValidPhone,
  normalizeEmail,
  normalizePhone,
  pendingEmailFromPhone,
} from "@/lib/identity";
import { generateTemporaryPassword, hashPassword } from "@/lib/password";
import { absoluteUrl, invitePath } from "@/lib/navigation";
import { sendInviteEmail, sendAddedToCommitteeEmail } from "@/lib/notify/email";
import { sendInviteSms, sendAddedToCommitteeSms } from "@/lib/notify/sms";

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

    await logActivity({
      entityType: "INVITE",
      entityId: existing.id,
      action: "COMMITTEE_MEMBER_ADDED",
      actorId: input.createdById,
      organizationId,
      metadata: { committeeId: input.committeeId, title: input.title },
    });

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

  await logActivity({
    entityType: "INVITE",
    entityId: invite.id,
    action: "INVITE_CREATED",
    actorId: input.createdById,
    organizationId,
    metadata: { targetType: "COMMITTEE", committeeId: input.committeeId },
  });

  return {
    type: "invite" as const,
    userId: user.id,
    inviteId: invite.id,
    token,
    inviteUrl,
    expiresAt: invite.expiresAt,
  };
}

export type CreateSupervisoryInviteInput = {
  name: string;
  email: string;
  phone?: string;
  organizationId: string;
  title: SupervisoryTitle;
  createdById: string;
  origin: string;
  sendNotifications?: boolean;
};

export async function createSupervisoryInvite(input: CreateSupervisoryInviteInput) {
  const email = normalizeEmail(input.email);
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (!isValidEmail(email)) throw new Error("Invalid email address");

  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    include: { settings: true },
  });
  if (!organization) throw new Error("Organization not found");

  const group = await prisma.supervisoryGroup.findFirst({
    where: { organizationId: input.organizationId },
  });
  if (!group) throw new Error("Governance group not found");

  const isHead = input.title === "HEAD";
  const roleTemplateKey = supervisoryTitleTemplateKey(input.title, isHead);
  const template = await prisma.roleTemplate.findUnique({
    where: {
      organizationId_key: {
        organizationId: input.organizationId,
        key: roleTemplateKey,
      },
    },
  });
  const caps = template?.capabilities;
  const canViewAll =
    caps && typeof caps === "object" && !Array.isArray(caps)
      ? (caps as { canViewAll?: boolean }).canViewAll === true
      : isHead || input.title === "SECRETARY";
  const canApproveOptional =
    caps && typeof caps === "object" && !Array.isArray(caps)
      ? (caps as { canApproveOptional?: boolean }).canApproveOptional === true
      : isHead || input.title === "SECRETARY";

  const existing = await prisma.user.findUnique({ where: { email } });
  const place =
    organization.settings?.supervisoryLabel ?? organization.name;
  const loginUrl = absoluteUrl("/", input.origin);

  const upsertSeat = async (userId: string) => {
    await prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId,
        },
      },
      create: {
        organizationId: input.organizationId,
        userId,
        role: "ORG_PARTICIPANT",
      },
      update: {},
    });
    await prisma.supervisoryMember.upsert({
      where: { userId_groupId: { userId, groupId: group.id } },
      create: {
        userId,
        groupId: group.id,
        isHead,
        title: input.title,
        roleTemplateKey,
        canViewAll,
        canApproveOptional,
      },
      update: {
        isHead,
        title: input.title,
        roleTemplateKey,
        canViewAll,
        canApproveOptional,
      },
    });
  };

  if (existing?.status === "ACTIVE" && existing.passwordHash) {
    await upsertSeat(existing.id);
    if (input.sendNotifications !== false) {
      await sendAddedToCommitteeEmail({
        to: email,
        name: existing.name,
        committeeName: place,
        loginUrl,
      });
    }
    await logActivity({
      entityType: "INVITE",
      entityId: existing.id,
      action: "GOVERNANCE_MEMBER_ADDED",
      actorId: input.createdById,
      organizationId: input.organizationId,
      metadata: { title: input.title },
    });
    return { type: "existing" as const, userId: existing.id, inviteUrl: null };
  }

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        phone,
        status: "PENDING",
      },
    }));

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { name: input.name.trim(), phone: phone ?? existing.phone },
    });
  }

  await upsertSeat(user.id);

  await prisma.invite.updateMany({
    where: {
      userId: user.id,
      organizationId: input.organizationId,
      targetType: "SUPERVISORY",
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const token = generateInviteToken();
  const invite = await prisma.invite.create({
    data: {
      token,
      organizationId: input.organizationId,
      userId: user.id,
      targetType: "SUPERVISORY",
      isSupervisoryHead: isHead,
      customTitle: input.title,
      createdById: input.createdById,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const inviteUrl = absoluteUrl(invitePath(token), input.origin);
  if (input.sendNotifications !== false) {
    await sendInviteEmail({
      to: email,
      name: user.name,
      organizationName: place,
      inviteUrl,
    });
    if (phone) {
      await sendInviteSms({
        to: phone,
        organizationName: place,
        inviteUrl,
      });
    }
  }

  await logActivity({
    entityType: "INVITE",
    entityId: invite.id,
    action: "INVITE_CREATED",
    actorId: input.createdById,
    organizationId: input.organizationId,
    metadata: { targetType: "SUPERVISORY", title: input.title },
  });

  return {
    type: "invite" as const,
    userId: user.id,
    inviteId: invite.id,
    token,
    inviteUrl,
    expiresAt: invite.expiresAt,
  };
}

async function findUserByEmailOrPhone(email?: string | null, phone?: string | null) {
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) return byEmail;
  }
  if (phone) {
    return prisma.user.findFirst({
      where: { OR: [{ phone }, { phone: normalizePhone(phone) }] },
    });
  }
  return null;
}

export async function createOrgAdminInviteForUser(input: {
  organizationId: string;
  userId: string;
  createdById: string;
  origin: string;
  organizationName: string;
  sendNotifications?: boolean;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) throw new Error("User not found");

  await prisma.invite.updateMany({
    where: {
      userId: user.id,
      organizationId: input.organizationId,
      targetType: { in: ["ORG_ADMIN", "ORGANIZATION"] },
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const token = generateInviteToken();
  const invite = await prisma.invite.create({
    data: {
      token,
      organizationId: input.organizationId,
      userId: user.id,
      targetType: "ORG_ADMIN",
      orgRole: "ORG_ADMIN",
      createdById: input.createdById,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const inviteUrl = absoluteUrl(invitePath(token), input.origin);
  if (input.sendNotifications !== false) {
    await sendInviteEmail({
      to: user.email,
      name: user.name,
      organizationName: input.organizationName,
      inviteUrl,
    });
  }

  await logActivity({
    entityType: "INVITE",
    entityId: invite.id,
    action: "INVITE_CREATED",
    actorId: input.createdById,
    organizationId: input.organizationId,
    metadata: { targetType: "ORG_ADMIN" },
  });

  return { inviteUrl, token, inviteId: invite.id };
}

export type AddOrgMemberInput = {
  organizationId: string;
  createdById: string;
  origin: string;
  name?: string;
  email?: string;
  phone?: string;
  orgRole: OrganizationMemberRole;
  mode: "invite" | "create";
  sendNotifications?: boolean;
};

export async function addOrgMember(input: AddOrgMemberInput) {
  const email = input.email?.trim()
    ? normalizeEmail(input.email)
    : null;
  const phone = input.phone?.trim()
    ? normalizePhone(input.phone)
    : null;

  if (!email && !phone) {
    throw new Error("Email or phone is required");
  }
  if (email && !isValidEmail(email)) {
    throw new Error("Invalid email address");
  }
  if (phone && !isValidPhone(phone)) {
    throw new Error("Invalid phone number");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
  });
  if (!organization) throw new Error("Organization not found");

  const existing = await findUserByEmailOrPhone(email, phone);
  const send = input.sendNotifications ?? true;
  const loginUrl = absoluteUrl("/", input.origin);

  if (input.mode === "create") {
    if (existing) {
      throw new Error(
        "This person already has an account. Invite them instead.",
      );
    }
    const name = input.name?.trim();
    if (!name) throw new Error("Name is required to create an account");

    const temporaryPassword = generateTemporaryPassword();
    const user = await prisma.user.create({
      data: {
        name,
        email: email ?? pendingEmailFromPhone(phone!),
        phone,
        status: "ACTIVE",
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        organizationMemberships: {
          create: {
            organizationId: input.organizationId,
            role: input.orgRole,
          },
        },
      },
    });

    return {
      type: "created" as const,
      userId: user.id,
      temporaryPassword,
    };
  }

  if (existing) {
    const already = await prisma.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: existing.id,
        },
      },
    });
    if (already) {
      throw new Error("Already a member of this organization");
    }

    if (existing.status === "ACTIVE" && existing.passwordHash) {
      await prisma.organizationMembership.create({
        data: {
          organizationId: input.organizationId,
          userId: existing.id,
          role: input.orgRole,
        },
      });

      if (send) {
        await sendAddedToCommitteeEmail({
          to: existing.email,
          name: existing.name,
          committeeName: organization.name,
          loginUrl,
        });
        const smsTo = phone ?? existing.phone;
        if (smsTo) {
          await sendAddedToCommitteeSms({
            to: smsTo,
            committeeName: organization.name,
            loginUrl,
          });
        }
      }

      return { type: "existing" as const, userId: existing.id };
    }
  }

  const name = input.name?.trim() || existing?.name;
  if (!name) {
    throw new Error("Name is required for a new account invite");
  }

  const user =
    existing ??
    (await prisma.user.create({
      data: {
        name,
        email: email ?? pendingEmailFromPhone(phone!),
        phone,
        status: "PENDING",
        organizationMemberships: {
          create: {
            organizationId: input.organizationId,
            role: input.orgRole,
          },
        },
      },
    }));

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        phone: phone ?? existing.phone,
      },
    });
    await prisma.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: existing.id,
        },
      },
      create: {
        organizationId: input.organizationId,
        userId: existing.id,
        role: input.orgRole,
      },
      update: { role: input.orgRole },
    });
  }

  await prisma.invite.updateMany({
    where: {
      userId: user.id,
      organizationId: input.organizationId,
      targetType: "ORGANIZATION",
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  const token = generateInviteToken();
  const invite = await prisma.invite.create({
    data: {
      token,
      organizationId: input.organizationId,
      userId: user.id,
      targetType: "ORGANIZATION",
      orgRole: input.orgRole,
      createdById: input.createdById,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const inviteUrl = absoluteUrl(invitePath(token), input.origin);

  if (send) {
    const to = email ?? user.email;
    await sendInviteEmail({
      to,
      name: user.name,
      organizationName: organization.name,
      inviteUrl,
    });
    if (phone) {
      await sendInviteSms({
        to: phone,
        organizationName: organization.name,
        inviteUrl,
      });
    }
  }

  await logActivity({
    entityType: "INVITE",
    entityId: invite.id,
    action: "INVITE_CREATED",
    actorId: input.createdById,
    organizationId: input.organizationId,
    metadata: { targetType: "ORGANIZATION", orgRole: input.orgRole },
  });

  return {
    type: "invite" as const,
    userId: user.id,
    inviteId: invite.id,
    token,
    inviteUrl,
    expiresAt: invite.expiresAt,
  };
}
