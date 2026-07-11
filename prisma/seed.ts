import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { COMMITTEE_CHARTER } from "../src/lib/committees";
import { hashPassword } from "../src/lib/password";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SEED_PASSWORD = "Steward123!";
const RESET =
  process.argv.includes("--reset") ||
  process.env.SEED_RESET === "1" ||
  process.env.SEED_RESET === "true";

type SeedUser = {
  key: string;
  name: string;
  email: string;
  phone: string;
  role:
    | "SUPER_ADMIN"
    | "SYSTEM_ADMIN"
    | "CHURCH_EXECUTIVE"
    | "COMMITTEE_PARTICIPANT";
  presbyteryHead?: boolean;
  presbyteryMember?: boolean;
};

const SEED_USERS: SeedUser[] = [
  {
    key: "admin",
    name: "Joseph Osei",
    email: "admin@unitycommit.org",
    phone: "+233 24 000 0001",
    role: "SUPER_ADMIN",
  },
  {
    key: "systemAdmin",
    name: "IT Systems Admin",
    email: "it@unitycommit.org",
    phone: "+233 24 000 0006",
    role: "SYSTEM_ADMIN",
  },
  {
    key: "executive",
    name: "Rev. General Overseer",
    email: "overseer@unitycommit.org",
    phone: "+233 24 000 0002",
    role: "CHURCH_EXECUTIVE",
    presbyteryHead: true,
  },
  {
    key: "presbyteryMember",
    name: "Elder Kwame Asante",
    email: "kwame@unitycommit.org",
    phone: "+233 24 000 0007",
    role: "CHURCH_EXECUTIVE",
    presbyteryMember: true,
  },
  {
    key: "chair",
    name: "Grace Mensah",
    email: "grace@unitycommit.org",
    phone: "+233 24 000 0003",
    role: "COMMITTEE_PARTICIPANT",
  },
  {
    key: "secretary",
    name: "James Osei",
    email: "james@unitycommit.org",
    phone: "+233 24 000 0004",
    role: "COMMITTEE_PARTICIPANT",
  },
  {
    key: "member",
    name: "Ama Boateng",
    email: "ama@unitycommit.org",
    phone: "+233 24 000 0005",
    role: "COMMITTEE_PARTICIPANT",
  },
];

function committeeBudget(letter: string) {
  return 5000 + (letter.charCodeAt(0) % 10) * 1000;
}

async function resetDatabase() {
  await prisma.otpChallenge.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.minutePoint.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.eventRsvp.deleteMany();
  await prisma.eventDeliverable.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.timelineGoal.deleteMany();
  await prisma.event.deleteMany();
  await prisma.committeeFeedback.deleteMany();
  await prisma.committeeMember.deleteMany();
  await prisma.presbyteryMember.deleteMany();
  await prisma.presbyteryGroup.deleteMany();
  await prisma.user.deleteMany();
  await prisma.committee.deleteMany();
}

async function ensureCommittees() {
  const committees = [];
  for (const c of COMMITTEE_CHARTER) {
    const committee = await prisma.committee.upsert({
      where: { charterLetter: c.letter },
      create: {
        charterLetter: c.letter,
        name: c.name,
        description: `${c.name} — church charter committee ${c.letter.toUpperCase()}`,
        budget: committeeBudget(c.letter),
        reportingFrequency: "Monthly",
      },
      update: {
        name: c.name,
        description: `${c.name} — church charter committee ${c.letter.toUpperCase()}`,
        reportingFrequency: "Monthly",
      },
    });
    committees.push(committee);
  }
  return committees;
}

async function ensureAppSettings() {
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", committeeBudgetsEnabled: false },
    update: {},
  });
}

async function ensurePresbyteryGroup() {
  const existing = await prisma.presbyteryGroup.findFirst({
    where: { name: "Presbytery" },
  });
  if (existing) return existing;
  return prisma.presbyteryGroup.create({ data: { name: "Presbytery" } });
}

async function ensureUser(
  spec: SeedUser,
  passwordHash: string,
  verifiedAt: Date,
) {
  const user = await prisma.user.upsert({
    where: { email: spec.email },
    create: {
      name: spec.name,
      email: spec.email,
      phone: spec.phone,
      role: spec.role,
      passwordHash,
      status: "ACTIVE",
      emailVerifiedAt: verifiedAt,
    },
    update: {
      name: spec.name,
      phone: spec.phone,
      role: spec.role,
    },
  });

  if (!user.passwordHash || user.status !== "ACTIVE") {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: "ACTIVE",
        emailVerifiedAt: user.emailVerifiedAt ?? verifiedAt,
      },
    });
  }

  return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
}

async function ensurePresbyteryMembership(
  userId: string,
  groupId: string,
  isHead: boolean,
) {
  const existing = await prisma.presbyteryMember.findUnique({
    where: { userId },
  });
  if (existing) {
    if (existing.isHead !== isHead || existing.groupId !== groupId) {
      await prisma.presbyteryMember.update({
        where: { userId },
        data: { isHead, groupId },
      });
    }
    return;
  }
  await prisma.presbyteryMember.create({
    data: { userId, groupId, isHead },
  });
}

async function ensureMembership(
  userId: string,
  committeeId: string,
  title: "CHAIR" | "SECRETARY" | "MEMBER",
) {
  await prisma.committeeMember.upsert({
    where: {
      userId_committeeId: { userId, committeeId },
    },
    create: { userId, committeeId, title },
    update: { title },
  });
}

async function ensureDemoContent(params: {
  estatesId: string;
  mediaId: string;
  financeId: string;
  firstCommitteeId: string;
  chairId: string;
  secretaryId: string;
  memberId: string;
  executiveId: string;
}) {
  const {
    estatesId,
    mediaId,
    financeId,
    firstCommitteeId,
    chairId,
    secretaryId,
    memberId,
    executiveId,
  } = params;
  const now = new Date();

  let project = await prisma.project.findFirst({
    where: { committeeId: estatesId, title: "Sanctuary Systems Upgrade" },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        title: "Sanctuary Systems Upgrade",
        description: "Sound and seating improvements",
        status: "ACTIVE",
        committeeId: estatesId,
        createdById: chairId,
      },
    });
  }

  const taskSpecs = [
    {
      title: "Soundboard Installation",
      description: "Install and test new sanctuary soundboard system",
      status: "IN_PROGRESS" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14),
      committeeId: estatesId,
      projectId: project.id,
      assignedToId: secretaryId,
      createdById: chairId,
    },
    {
      title: "Sanctuary Seating Upgrade",
      description: "Complete seating refurbishment project",
      status: "DONE" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
      committeeId: estatesId,
      projectId: project.id,
      assignedToId: memberId,
      createdById: chairId,
    },
    {
      title: "Permit Application Review",
      description: "Awaiting municipal approval for expansion",
      status: "BLOCKED" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
      committeeId: estatesId,
      assignedToId: chairId,
      createdById: chairId,
    },
    {
      title: "Weekly Bulletin Design",
      status: "TODO" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
      committeeId: mediaId,
      assignedToId: memberId,
      createdById: chairId,
    },
  ];

  for (const spec of taskSpecs) {
    const existing = await prisma.task.findFirst({
      where: { committeeId: spec.committeeId, title: spec.title },
    });
    if (!existing) {
      await prisma.task.create({ data: spec });
    }
  }

  let presbyteryAssignment = await prisma.assignment.findFirst({
    where: { title: "Annual budget review presentation" },
  });
  if (!presbyteryAssignment) {
    presbyteryAssignment = await prisma.assignment.create({
      data: {
        title: "Annual budget review presentation",
        description:
          "Prepare consolidated budget summary for Presbytery quarterly review",
        source: "PRESBYTERY",
        status: "ASSIGNED",
        priority: "HIGH",
        createdById: executiveId,
        targetCommitteeId: financeId,
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 21),
      },
    });
  }

  const referralExists = await prisma.assignment.findFirst({
    where: { title: "Coordinate media coverage for renovation" },
  });
  if (!referralExists) {
    await prisma.assignment.create({
      data: {
        title: "Coordinate media coverage for renovation",
        description: "Estates requests media team support for progress updates",
        source: "COMMITTEE_REFERRAL",
        status: "ASSIGNED",
        priority: "NORMAL",
        createdById: chairId,
        targetCommitteeId: mediaId,
        sourceCommitteeId: estatesId,
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10),
      },
    });
  }

  const activityExists = await prisma.activityLog.findFirst({
    where: {
      entityType: "ASSIGNMENT",
      entityId: presbyteryAssignment.id,
      action: "ASSIGNED",
    },
  });
  if (!activityExists) {
    await prisma.activityLog.create({
      data: {
        entityType: "ASSIGNMENT",
        entityId: presbyteryAssignment.id,
        action: "ASSIGNED",
        actorId: executiveId,
        metadata: { title: presbyteryAssignment.title },
      },
    });
  }

  let meeting = await prisma.meeting.findFirst({
    where: { committeeId: estatesId, title: "Estates Monthly Review" },
  });
  if (!meeting) {
    meeting = await prisma.meeting.create({
      data: {
        title: "Estates Monthly Review",
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
        committeeId: estatesId,
        createdById: secretaryId,
        approved: false,
      },
    });

    await prisma.attendance.createMany({
      data: [
        { meetingId: meeting.id, userId: chairId, status: "PRESENT" },
        { meetingId: meeting.id, userId: secretaryId, status: "PRESENT" },
        { meetingId: meeting.id, userId: memberId, status: "EXCUSED" },
      ],
      skipDuplicates: true,
    });

    const minutePoints = [
      "Reviewed sanctuary seating upgrade — project marked complete.",
      "Soundboard installation scheduled for next two weeks.",
      "Permit application still pending municipal review.",
    ];
    for (let i = 0; i < minutePoints.length; i++) {
      const exists = await prisma.minutePoint.findFirst({
        where: { meetingId: meeting.id, order: i + 1 },
      });
      if (!exists) {
        await prisma.minutePoint.create({
          data: {
            meetingId: meeting.id,
            order: i + 1,
            content: minutePoints[i],
          },
        });
      }
    }
  }

  const eventSpecs = [
    {
      title: "Estates Committee Meeting",
      description: "Monthly progress review",
      startDate: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 10,
        18,
        0,
      ),
      committeeId: estatesId,
    },
    {
      title: "Media Team Planning Session",
      startDate: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 3,
        10,
        0,
      ),
      committeeId: mediaId,
    },
    {
      title: "Presbytery Quarterly Review",
      description: "All committees report progress",
      startDate: new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 21,
        9,
        0,
      ),
      committeeId: firstCommitteeId,
    },
  ];

  for (const spec of eventSpecs) {
    const existing = await prisma.event.findFirst({
      where: { committeeId: spec.committeeId, title: spec.title },
    });
    if (!existing) {
      await prisma.event.create({ data: spec });
    }
  }

  const timelineSpecs = [
    {
      title: "Sanctuary Renovation Phase 2",
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 3, 1),
      progress: 65,
      committeeId: estatesId,
    },
    {
      title: "Annual Media Campaign",
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 2, 15),
      progress: 30,
      committeeId: mediaId,
    },
  ];

  for (const spec of timelineSpecs) {
    const existing = await prisma.timelineGoal.findFirst({
      where: { committeeId: spec.committeeId, title: spec.title },
    });
    if (!existing) {
      await prisma.timelineGoal.create({ data: spec });
    }
  }
}

async function main() {
  if (RESET) {
    console.info("SEED_RESET enabled — wiping database before seeding…");
    await resetDatabase();
  }

  const committees = await ensureCommittees();
  await ensureAppSettings();
  const presbyteryGroup = await ensurePresbyteryGroup();
  const verifiedAt = new Date();
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const users: Record<string, { id: string; email: string }> = {};
  for (const spec of SEED_USERS) {
    const user = await ensureUser(spec, passwordHash, verifiedAt);
    users[spec.key] = { id: user.id, email: user.email };

    if (spec.presbyteryHead || spec.presbyteryMember) {
      await ensurePresbyteryMembership(
        user.id,
        presbyteryGroup.id,
        spec.presbyteryHead === true,
      );
    }
  }

  const estates = committees.find((c) => c.charterLetter === "c")!;
  const media = committees.find((c) => c.charterLetter === "e")!;
  const finance = committees.find((c) => c.charterLetter === "a")!;

  await ensureMembership(users.chair.id, estates.id, "CHAIR");
  await ensureMembership(users.secretary.id, estates.id, "SECRETARY");
  await ensureMembership(users.member.id, estates.id, "MEMBER");
  await ensureMembership(users.chair.id, media.id, "MEMBER");

  await ensureDemoContent({
    estatesId: estates.id,
    mediaId: media.id,
    financeId: finance.id,
    firstCommitteeId: committees[0].id,
    chairId: users.chair.id,
    secretaryId: users.secretary.id,
    memberId: users.member.id,
    executiveId: users.executive.id,
  });

  console.log("Seed complete (idempotent):", {
    mode: RESET ? "reset" : "ensure",
    committees: committees.length,
    users: SEED_USERS.length,
    password: `${SEED_PASSWORD} (set only when missing)`,
    login: Object.fromEntries(
      SEED_USERS.map((u) => [u.key, users[u.key].email]),
    ),
    tip: "Run npm run db:seed:reset to wipe and reseed from scratch",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
