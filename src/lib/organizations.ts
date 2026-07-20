import { prisma } from "@/lib/prisma";
import type { OrganizationMemberRole } from "@/lib/types";
import {
  CHURCH_APPROVAL_STACK,
  DEFAULT_APPROVAL_STACK,
} from "@/lib/types";
import { COMMITTEE_CHARTER } from "@/lib/committees";

const DEFAULT_ROLE_TEMPLATES = [
  {
    key: "CHAIR",
    name: "Chair",
    description: "Committee chairperson",
    sortOrder: 1,
    capabilities: {
      editTasks: true,
      logMinutes: true,
      approveMinutes: true,
      invite: true,
      submitReports: true,
    },
  },
  {
    key: "DEPUTY",
    name: "Deputy",
    description: "Deputy chair",
    sortOrder: 2,
    capabilities: {
      editTasks: true,
      logMinutes: true,
      submitReports: true,
    },
  },
  {
    key: "SECRETARY",
    name: "Secretary",
    description: "Committee secretary",
    sortOrder: 3,
    capabilities: {
      editTasks: true,
      logMinutes: true,
      submitReports: true,
    },
  },
  {
    key: "MEMBER",
    name: "Member",
    description: "Committee member",
    sortOrder: 4,
    capabilities: { updateAssignedTasks: true },
  },
] as const;

export type OrgTemplateId = "blank" | "church" | "board";

export async function createOrganization(input: {
  name: string;
  slug: string;
  ownerUserId: string;
  template?: OrgTemplateId;
  supervisoryLabel?: string;
  committeeLabel?: string;
}) {
  const template = input.template ?? "blank";
  const supervisoryLabel =
    input.supervisoryLabel ??
    (template === "church"
      ? "Presbytery"
      : template === "board"
        ? "Board"
        : "Supervisory Group");
  const committeeLabel = input.committeeLabel ?? "Committee";

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        settings: {
          create: {
            supervisoryLabel,
            committeeLabel,
            committeeBudgetsEnabled: false,
            allowCrossCommitteeRead: false,
            requireOversightOnSelfInitiated: true,
            allowSupervisoryAssignMembers: true,
            approvalStack:
              template === "church"
                ? CHURCH_APPROVAL_STACK
                : DEFAULT_APPROVAL_STACK,
          },
        },
        memberships: {
          create: {
            userId: input.ownerUserId,
            role: "ORG_ADMIN",
          },
        },
        supervisoryGroups: {
          create: { name: supervisoryLabel },
        },
        roleTemplates: {
          create: DEFAULT_ROLE_TEMPLATES.map((t) => ({
            key: t.key,
            name: t.name,
            description: t.description,
            sortOrder: t.sortOrder,
            capabilities: t.capabilities,
          })),
        },
      },
      include: {
        settings: true,
        supervisoryGroups: true,
      },
    });

    if (template === "church") {
      await tx.committee.createMany({
        data: COMMITTEE_CHARTER.map((c, i) => ({
          organizationId: org.id,
          charterLetter: c.letter,
          name: c.name,
          description: `${c.name} — charter committee ${c.letter.toUpperCase()}`,
          reportingFrequency: "Monthly",
          sortOrder: i,
        })),
      });
    } else if (template === "board") {
      const boards = [
        { key: "exec", name: "Executive Committee" },
        { key: "fin", name: "Finance Committee" },
        { key: "ops", name: "Operations Committee" },
        { key: "gov", name: "Governance Committee" },
      ];
      await tx.committee.createMany({
        data: boards.map((c, i) => ({
          organizationId: org.id,
          charterLetter: c.key,
          name: c.name,
          reportingFrequency: "Monthly",
          sortOrder: i,
        })),
      });
    }

    return org;
  });
}

export async function transferOrgAdmin(input: {
  organizationId: string;
  fromUserId: string;
  toUserId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const target = await tx.organizationMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.toUserId,
        },
      },
    });
    if (!target) {
      throw new Error("Target user is not a member of this organization");
    }

    await tx.organizationMembership.update({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.fromUserId,
        },
      },
      data: { role: "ORG_PARTICIPANT" },
    });

    await tx.organizationMembership.update({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.toUserId,
        },
      },
      data: { role: "ORG_ADMIN" },
    });

    await tx.user.update({
      where: { id: input.toUserId },
      data: { role: "ORG_ADMIN" },
    });
    await tx.user.update({
      where: { id: input.fromUserId },
      data: { role: "ORG_PARTICIPANT" },
    });
  });
}

export async function listUserOrganizations(userId: string) {
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId },
    include: {
      organization: { include: { settings: true } },
    },
    orderBy: { organization: { name: "asc" } },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      committeeMemberships: {
        include: { committee: true },
      },
      supervisoryMemberships: {
        include: { group: true },
      },
    },
  });

  return memberships.map((m) => {
    const committeeMemberships = (user?.committeeMemberships ?? []).filter(
      (c) => c.committee.organizationId === m.organizationId,
    );
    const titles = committeeMemberships.map((c) => c.customTitle || c.title);

    const supervisory = (user?.supervisoryMemberships ?? []).find(
      (s) => s.group.organizationId === m.organizationId,
    );

    const rolesSummary: string[] = [];
    if (m.role === "ORG_ADMIN") rolesSummary.push("Org Admin");
    if (m.role === "ORG_TECH") rolesSummary.push("Org Tech");
    if (supervisory?.isHead) {
      rolesSummary.push(
        `${m.organization.settings?.supervisoryLabel ?? "Supervisory"} Head`,
      );
    } else if (supervisory) {
      rolesSummary.push(
        m.organization.settings?.supervisoryLabel ?? "Supervisory",
      );
    }
    for (const t of titles) {
      const label = String(t);
      if (!rolesSummary.includes(label)) rolesSummary.push(label);
    }
    if (rolesSummary.length === 0) rolesSummary.push("Member");

    const groupCount =
      committeeMemberships.length + (supervisory ? 1 : 0);

    return {
      organizationId: m.organizationId,
      name: m.organization.name,
      slug: m.organization.slug,
      status: m.organization.status,
      orgRole: m.role as OrganizationMemberRole,
      supervisoryLabel:
        m.organization.settings?.supervisoryLabel ?? "Supervisory Group",
      committeeLabel: m.organization.settings?.committeeLabel ?? "Committee",
      rolesSummary,
      roleCount: rolesSummary.length,
      groupCount,
    };
  });
}
