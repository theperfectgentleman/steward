import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { hashPassword } from "../src/lib/password";
import {
  CHURCH_COMMITTEE_APPROVAL_STACK,
  CHURCH_DIRECTIVE_APPROVAL_STACK,
} from "../src/lib/types";
import { CHURCH_ROLE_TEMPLATE_SEEDS } from "../src/lib/role-capabilities";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = "Steward123!";

async function main() {
  console.log("Seeding Accra North Region organization…");

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);
  const now = new Date();

  // 1. Ensure admin@unitycommit.org exists
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@unitycommit.org" },
    create: {
      name: "Joseph Osei",
      email: "admin@unitycommit.org",
      phone: "+233 24 000 0001",
      role: "ORG_ADMIN",
      passwordHash,
      status: "ACTIVE",
      emailVerifiedAt: now,
    },
    update: {
      status: "ACTIVE",
    },
  });

  // 2. Ensure it@unitycommit.org exists
  const itUser = await prisma.user.upsert({
    where: { email: "it@unitycommit.org" },
    create: {
      name: "IT Systems Admin",
      email: "it@unitycommit.org",
      phone: "+233 24 000 0006",
      role: "ORG_TECH",
      passwordHash,
      status: "ACTIVE",
      emailVerifiedAt: now,
    },
    update: {
      status: "ACTIVE",
    },
  });

  // 3. Ensure dummy chairperson user exists
  const chairEmail = "chair.accranorth@unitycommit.org";
  const chairUser = await prisma.user.upsert({
    where: { email: chairEmail },
    create: {
      name: "Elder Emmanuel Darko",
      email: chairEmail,
      phone: "+233 24 111 0001",
      role: "ORG_PARTICIPANT",
      passwordHash,
      status: "ACTIVE",
      emailVerifiedAt: now,
    },
    update: {
      name: "Elder Emmanuel Darko",
      passwordHash,
      status: "ACTIVE",
    },
  });

  // 4. Ensure Organization "Accra North Region" exists
  const orgSlug = "accra-north-region";
  const org = await prisma.organization.upsert({
    where: { slug: orgSlug },
    create: {
      name: "Accra North Region",
      slug: orgSlug,
      status: "ACTIVE",
      settings: {
        create: {
          supervisoryLabel: "Presbytery",
          committeeLabel: "Committee",
          committeeBudgetsEnabled: true,
          allowCrossCommitteeRead: false,
          requireOversightOnSelfInitiated: true,
          allowSupervisoryAssignMembers: true,
          directiveApprovalStack: CHURCH_DIRECTIVE_APPROVAL_STACK,
          committeeApprovalStack: CHURCH_COMMITTEE_APPROVAL_STACK,
        },
      },
    },
    update: {
      name: "Accra North Region",
      status: "ACTIVE",
    },
  });

  // 5. Ensure OrganizationSettings
  await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      supervisoryLabel: "Presbytery",
      committeeLabel: "Committee",
      committeeBudgetsEnabled: true,
      allowCrossCommitteeRead: false,
      requireOversightOnSelfInitiated: true,
      allowSupervisoryAssignMembers: true,
      directiveApprovalStack: CHURCH_DIRECTIVE_APPROVAL_STACK,
      committeeApprovalStack: CHURCH_COMMITTEE_APPROVAL_STACK,
    },
    update: {
      supervisoryLabel: "Presbytery",
      committeeLabel: "Committee",
      directiveApprovalStack: CHURCH_DIRECTIVE_APPROVAL_STACK,
      committeeApprovalStack: CHURCH_COMMITTEE_APPROVAL_STACK,
    },
  });

  // 6. Ensure Supervisory Group exists
  const existingSg = await prisma.supervisoryGroup.findFirst({
    where: { organizationId: org.id },
  });
  if (existingSg) {
    await prisma.supervisoryGroup.update({
      where: { id: existingSg.id },
      data: { name: "Presbytery" },
    });
  } else {
    await prisma.supervisoryGroup.create({
      data: {
        name: "Presbytery",
        organizationId: org.id,
      },
    });
  }

  // 7. Seed Role Templates for this org
  for (const t of CHURCH_ROLE_TEMPLATE_SEEDS) {
    await prisma.roleTemplate.upsert({
      where: {
        organizationId_key: { organizationId: org.id, key: t.key },
      },
      create: {
        organizationId: org.id,
        key: t.key,
        name: t.name,
        description: t.description,
        sortOrder: t.sortOrder,
        capabilities: t.capabilities,
      },
      update: {
        name: t.name,
        description: t.description,
        sortOrder: t.sortOrder,
        capabilities: t.capabilities,
      },
    });
  }

  // 8. Ensure 2 demo committees (Finance Committee, Estates & Projects Management)
  const financeComm = await prisma.committee.upsert({
    where: {
      organizationId_charterLetter: {
        organizationId: org.id,
        charterLetter: "a",
      },
    },
    create: {
      organizationId: org.id,
      charterLetter: "a",
      name: "Finance Committee",
      description: "Finance Committee — regional charter committee A",
      budget: 12000,
      reportingFrequency: "Monthly",
      sortOrder: 1,
    },
    update: {
      name: "Finance Committee",
      description: "Finance Committee — regional charter committee A",
      budget: 12000,
      reportingFrequency: "Monthly",
    },
  });

  const estatesComm = await prisma.committee.upsert({
    where: {
      organizationId_charterLetter: {
        organizationId: org.id,
        charterLetter: "c",
      },
    },
    create: {
      organizationId: org.id,
      charterLetter: "c",
      name: "Estates & Projects Management",
      description:
        "Estates & Projects Management — regional charter committee C",
      budget: 14000,
      reportingFrequency: "Monthly",
      sortOrder: 2,
    },
    update: {
      name: "Estates & Projects Management",
      description:
        "Estates & Projects Management — regional charter committee C",
      budget: 14000,
      reportingFrequency: "Monthly",
    },
  });

  // 9. Ensure Organization Memberships
  // Admin -> ORG_ADMIN
  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: adminUser.id,
      },
    },
    create: {
      organizationId: org.id,
      userId: adminUser.id,
      role: "ORG_ADMIN",
    },
    update: {
      role: "ORG_ADMIN",
    },
  });

  // IT Systems Admin -> ORG_TECH
  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: itUser.id,
      },
    },
    create: {
      organizationId: org.id,
      userId: itUser.id,
      role: "ORG_TECH",
    },
    update: {
      role: "ORG_TECH",
    },
  });

  // Dummy chair -> ORG_PARTICIPANT
  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: org.id,
        userId: chairUser.id,
      },
    },
    create: {
      organizationId: org.id,
      userId: chairUser.id,
      role: "ORG_PARTICIPANT",
    },
    update: {
      role: "ORG_PARTICIPANT",
    },
  });

  // 10. Assign dummy chair as Chairperson of Finance Committee
  await prisma.committeeMember.upsert({
    where: {
      userId_committeeId: {
        userId: chairUser.id,
        committeeId: financeComm.id,
      },
    },
    create: {
      userId: chairUser.id,
      committeeId: financeComm.id,
      title: "CHAIR",
      customTitle: "Finance Committee Chairperson",
    },
    update: {
      title: "CHAIR",
      customTitle: "Finance Committee Chairperson",
    },
  });

  console.log("\n✔ Seed complete for 'Accra North Region':");
  console.log({
    organizationId: org.id,
    name: org.name,
    slug: org.slug,
    committees: [
      { id: financeComm.id, name: financeComm.name, letter: financeComm.charterLetter },
      { id: estatesComm.id, name: estatesComm.name, letter: estatesComm.charterLetter },
    ],
    users: [
      { email: adminUser.email, role: "ORG_ADMIN" },
      { email: itUser.email, role: "ORG_TECH" },
      {
        email: chairUser.email,
        name: chairUser.name,
        role: "ORG_PARTICIPANT",
        assignedTo: `${financeComm.name} (CHAIR)`,
        password: DEFAULT_PASSWORD,
      },
    ],
  });
}

main()
  .catch((e) => {
    console.error("Error seeding Accra North Region:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
