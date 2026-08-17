import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { COMMITTEE_CHARTER } from "../src/lib/committees";
import { hashPassword } from "../src/lib/password";
import { CHURCH_COMMITTEE_APPROVAL_STACK, CHURCH_DIRECTIVE_APPROVAL_STACK } from "../src/lib/types";

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
  role: "ORG_ADMIN" | "ORG_TECH" | "ORG_PARTICIPANT";
  supervisoryHead?: boolean;
  supervisorySecretary?: boolean;
  supervisoryMember?: boolean;
};

const ICGC_ORG_ID = "org_icgc_demo";
const ICGC_SLUG = "icgc";

const SEED_USERS: SeedUser[] = [
  {
    key: "admin",
    name: "Joseph Osei",
    email: "admin@unitycommit.org",
    phone: "+233 24 000 0001",
    role: "ORG_ADMIN",
  },
  {
    key: "systemAdmin",
    name: "IT Systems Admin",
    email: "it@unitycommit.org",
    phone: "+233 24 000 0006",
    role: "ORG_TECH",
  },
  {
    key: "executive",
    name: "Rev. General Overseer",
    email: "overseer@unitycommit.org",
    phone: "+233 24 000 0002",
    role: "ORG_PARTICIPANT",
    supervisoryHead: true,
  },
  {
    key: "generalSecretary",
    name: "Rev. General Secretary",
    email: "gs@unitycommit.org",
    phone: "+233 24 000 0008",
    role: "ORG_PARTICIPANT",
    supervisorySecretary: true,
  },
  {
    key: "supervisoryMember",
    name: "Elder Kwame Asante",
    email: "kwame@unitycommit.org",
    phone: "+233 24 000 0007",
    role: "ORG_PARTICIPANT",
    supervisoryMember: true,
  },
  {
    key: "chair",
    name: "Grace Mensah",
    email: "grace@unitycommit.org",
    phone: "+233 24 000 0003",
    role: "ORG_PARTICIPANT",
  },
  {
    key: "secretary",
    name: "James Osei",
    email: "james@unitycommit.org",
    phone: "+233 24 000 0004",
    role: "ORG_PARTICIPANT",
  },
  {
    key: "member",
    name: "Ama Boateng",
    email: "ama@unitycommit.org",
    phone: "+233 24 000 0005",
    role: "ORG_PARTICIPANT",
  },
];

function committeeBudget(letter: string) {
  return 5000 + (letter.charCodeAt(0) % 10) * 1000;
}

async function resetDatabase() {
  await prisma.otpChallenge.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.message.deleteMany();
  await prisma.messageParticipant.deleteMany();
  await prisma.messageThread.deleteMany();
  await prisma.agendaItem.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.document.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.minutePoint.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.eventRsvp.deleteMany();
  await prisma.eventDeliverable.deleteMany();
  await prisma.task.deleteMany();
  await prisma.timelineGoal.deleteMany();
  await prisma.event.deleteMany();
  await prisma.committeeFeedback.deleteMany();
  await prisma.libraryDocument.deleteMany();
  await prisma.committeeMember.deleteMany();
  await prisma.supervisoryMember.deleteMany();
  await prisma.supervisoryGroup.deleteMany();
  await prisma.roleTemplate.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.organizationSettings.deleteMany();
  await prisma.platformAdmin.deleteMany();
  await prisma.user.deleteMany();
  await prisma.committee.deleteMany();
  await prisma.organization.deleteMany();
}

async function ensureIcgOrg() {
  const org = await prisma.organization.upsert({
    where: { slug: ICGC_SLUG },
    create: {
      id: ICGC_ORG_ID,
      name: "ICGC",
      slug: ICGC_SLUG,
      status: "ACTIVE",
      settings: {
        create: {
          supervisoryLabel: "Presbytery",
          committeeLabel: "Committee",
          committeeBudgetsEnabled: false,
          allowCrossCommitteeRead: false,
          requireOversightOnSelfInitiated: true,
          allowSupervisoryAssignMembers: true,
          directiveApprovalStack: CHURCH_DIRECTIVE_APPROVAL_STACK,
          committeeApprovalStack: CHURCH_COMMITTEE_APPROVAL_STACK,
        },
      },
    },
    update: { name: "ICGC", status: "ACTIVE" },
  });

  await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      supervisoryLabel: "Presbytery",
      committeeLabel: "Committee",
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

  const templates = [
    { key: "CHAIR", name: "Chair", sortOrder: 1 },
    { key: "DEPUTY", name: "Deputy", sortOrder: 2 },
    { key: "SECRETARY", name: "Secretary", sortOrder: 3 },
    { key: "MEMBER", name: "Member", sortOrder: 4 },
    {
      key: "SUPERVISORY_HEAD",
      name: "General Overseer",
      sortOrder: 10,
    },
    {
      key: "SUPERVISORY_SECRETARY",
      name: "General Secretary",
      sortOrder: 11,
    },
  ];
  for (const t of templates) {
    await prisma.roleTemplate.upsert({
      where: {
        organizationId_key: { organizationId: org.id, key: t.key },
      },
      create: {
        organizationId: org.id,
        key: t.key,
        name: t.name,
        sortOrder: t.sortOrder,
        capabilities: {},
      },
      update: { name: t.name, sortOrder: t.sortOrder },
    });
  }

  return org;
}

async function ensureCommittees(organizationId: string) {
  const committees = [];
  for (let i = 0; i < COMMITTEE_CHARTER.length; i++) {
    const c = COMMITTEE_CHARTER[i];
    const committee = await prisma.committee.upsert({
      where: {
        organizationId_charterLetter: {
          organizationId,
          charterLetter: c.letter,
        },
      },
      create: {
        organizationId,
        charterLetter: c.letter,
        name: c.name,
        description: `${c.name} — church charter committee ${c.letter.toUpperCase()}`,
        budget: committeeBudget(c.letter),
        reportingFrequency: "Monthly",
        sortOrder: i,
      },
      update: {
        name: c.name,
        description: `${c.name} — church charter committee ${c.letter.toUpperCase()}`,
        reportingFrequency: "Monthly",
        sortOrder: i,
      },
    });
    committees.push(committee);
  }
  return committees;
}

async function ensureSupervisoryGroup(organizationId: string) {
  const existing = await prisma.supervisoryGroup.findFirst({
    where: { organizationId },
  });
  if (existing) {
    return prisma.supervisoryGroup.update({
      where: { id: existing.id },
      data: { name: "Presbytery" },
    });
  }
  return prisma.supervisoryGroup.create({
    data: { name: "Presbytery", organizationId },
  });
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
      passwordHash,
      status: "ACTIVE",
      emailVerifiedAt: verifiedAt,
    },
  });

  return user;
}

async function ensureOrgMembership(
  organizationId: string,
  userId: string,
  role: "ORG_ADMIN" | "ORG_TECH" | "ORG_PARTICIPANT",
) {
  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: { organizationId, userId },
    },
    create: { organizationId, userId, role },
    update: { role },
  });
}

async function ensureSupervisoryMembership(
  userId: string,
  groupId: string,
  opts: {
    isHead?: boolean;
    title?: "HEAD" | "SECRETARY" | "MEMBER" | "CUSTOM";
    customTitle?: string;
    canViewAll?: boolean;
    canApproveOptional?: boolean;
  },
) {
  const isHead = opts.isHead === true || opts.title === "HEAD";
  const title = opts.title ?? (isHead ? "HEAD" : "MEMBER");
  await prisma.supervisoryMember.upsert({
    where: {
      userId_groupId: { userId, groupId },
    },
    create: {
      userId,
      groupId,
      isHead,
      title,
      customTitle: opts.customTitle,
      canViewAll: opts.canViewAll ?? (isHead || title === "SECRETARY"),
      canApproveOptional: opts.canApproveOptional ?? isHead,
    },
    update: {
      isHead,
      title,
      customTitle: opts.customTitle,
      canViewAll: opts.canViewAll ?? (isHead || title === "SECRETARY"),
      canApproveOptional: opts.canApproveOptional ?? isHead,
    },
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
  committees: any[];
  users: Record<string, { id: string; email: string }>;
  organizationId: string;
}) {
  const { committees, users, organizationId } = params;
  const now = new Date();

  const getComm = (letter: string) => committees.find((c) => c.charterLetter === letter)!;
  const estates = getComm("c");
  const media = getComm("e");
  const finance = getComm("a");
  const missions = getComm("b");
  const worship = getComm("g");
  const youth = getComm("j");
  const itComm = getComm("f");
  const disciplinary = getComm("d");

  const chairId = users.chair.id;
  const secretaryId = users.secretary.id;
  const memberId = users.member.id;
  const executiveId = users.executive.id;

  // 1. TASKS (no Project product path)
  const taskSpecs = [
    {
      title: "Soundboard Installation",
      description: "Install and test new sanctuary soundboard system",
      status: "IN_PROGRESS" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14),
      committeeId: estates.id,
      assignedToId: secretaryId,
      createdById: chairId,
    },
    {
      title: "Sanctuary Seating Upgrade",
      description:
        "Directive: complete sanctuary seating refurbishment and close with governance review",
      status: "IN_PROGRESS" as const,
      workClass: "DIRECTIVE" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 21),
      committeeId: estates.id,
      assignedToId: chairId,
      createdById: executiveId,
    },
    {
      title: "Permit Application Review",
      description: "Awaiting municipal approval for sanctuary extension",
      status: "BLOCKED" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
      committeeId: estates.id,
      assignedToId: chairId,
      createdById: chairId,
    },
    {
      title: "Electrical Rewiring & Lighting",
      description: "Replace legacy wiring and install low-energy LED fixtures",
      status: "TODO" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 18),
      committeeId: estates.id,
      assignedToId: memberId,
      createdById: chairId,
    },
    {
      title: "Drywall & Painting",
      description: "Install drywall partitions and paint walls with brand colors",
      status: "TODO" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 28),
      committeeId: estates.id,
      assignedToId: secretaryId,
      createdById: chairId,
    },
    {
      title: "Choir Rehearsal Schedule",
      description: "Draw up calendar for weekly rehearsals and send to all members",
      status: "IN_PROGRESS" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
      committeeId: worship.id,
      assignedToId: secretaryId,
      createdById: chairId,
    },
    {
      title: "Dry Clean Choir Robes",
      description: "Collect all robes and send for professional dry cleaning",
      status: "TODO" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 20),
      committeeId: worship.id,
      assignedToId: memberId,
      createdById: chairId,
    },
    {
      title: "Invite Guest Instrumentalists",
      description: "Draft letters and follow up with the guest violinist and keyboardist",
      status: "DONE" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5),
      committeeId: worship.id,
      assignedToId: chairId,
      createdById: chairId,
    },
    {
      title: "Procure Medical Supplies",
      description: "Liaise with pharmaceutical partners to secure essential medicines",
      status: "IN_PROGRESS" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10),
      committeeId: missions.id,
      assignedToId: memberId,
      createdById: memberId,
    },
    {
      title: "Recruit Volunteer Doctors & Nurses",
      description: "Reach out to medical professionals in the congregation",
      status: "TODO" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 22),
      committeeId: missions.id,
      assignedToId: memberId,
      createdById: memberId,
    },
    {
      title: "Bus Hire and Logistics",
      description: "Arrange transport and feeding packages for the volunteer team",
      status: "DONE" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
      committeeId: missions.id,
      assignedToId: secretaryId,
      createdById: memberId,
    },
    {
      title: "Weekly Bulletin Design",
      status: "TODO" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
      committeeId: media.id,
      assignedToId: memberId,
      createdById: chairId,
    },
    {
      title: "Livestream Setup Test",
      description: "Test high-definition stream setup on YouTube and Facebook live",
      status: "DONE" as const,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      committeeId: media.id,
      assignedToId: secretaryId,
      createdById: chairId,
    },
    {
      title: "Youth Center Flooring Spec",
      description: "Select and order flooring for the renovated youth hall",
      status: "IN_REVIEW" as const,
      workClass: "COMMITTEE" as const,
      approvalStepIndex: 0,
      dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 9),
      committeeId: estates.id,
      assignedToId: secretaryId,
      createdById: chairId,
    },
  ];

  const tasks: Record<string, any> = {};
  for (const spec of taskSpecs) {
    let existing = await prisma.task.findFirst({
      where: { committeeId: spec.committeeId, title: spec.title },
    });
    if (!existing) {
      existing = await prisma.task.create({ data: { ...spec, organizationId } as never });
    } else if (spec.title === "Sanctuary Seating Upgrade") {
      existing = await prisma.task.update({
        where: { id: existing.id },
        data: {
          status: "IN_PROGRESS",
          workClass: "DIRECTIVE",
          description: spec.description,
          assignedToId: chairId,
          createdById: executiveId,
        } as never,
      });
    }
    tasks[spec.title] = existing;
  }

  // Sanctuary seats walkthrough: Directive → Committee child → optional Personal
  const directive = tasks["Sanctuary Seating Upgrade"];
  if (directive) {
    let committeeChild = await prisma.task.findFirst({
      where: {
        parentId: directive.id,
        title: "Source and install sanctuary seats",
      },
    });
    if (!committeeChild) {
      committeeChild = await prisma.task.create({
        data: {
          title: "Source and install sanctuary seats",
          description: "Committee work under the seating directive",
          status: "IN_PROGRESS",
          workClass: "COMMITTEE",
          organizationId,
          committeeId: estates.id,
          parentId: directive.id,
          assignedToId: secretaryId,
          createdById: chairId,
        } as never,
      });
    }
    let personalStep = await prisma.task.findFirst({
      where: {
        parentId: committeeChild.id,
        title: "Measure aisle clearances",
      },
    });
    if (!personalStep) {
      await prisma.task.create({
        data: {
          title: "Measure aisle clearances",
          description: "Optional personal step — does not block review",
          status: "TODO",
          workClass: "PERSONAL",
          organizationId,
          committeeId: estates.id,
          parentId: committeeChild.id,
          assignedToId: memberId,
          createdById: secretaryId,
        } as never,
      });
    }
  }

  // 2. COMMENTS ON TASKS
  const commentSpecs = [
    {
      body: "The municipal council has requested an updated structural drawing before issuing the permit extension.",
      authorId: chairId,
      entityType: "TASK" as const,
      entityId: tasks["Permit Application Review"].id,
    },
    {
      body: "I've contacted our consulting architect; he should deliver the revised drawings by Friday.",
      authorId: secretaryId,
      entityType: "TASK" as const,
      entityId: tasks["Permit Application Review"].id,
    },
    {
      body: "Mixer board and wireless microphone rack successfully delivered. Cabinet setup starts tomorrow.",
      authorId: secretaryId,
      entityType: "TASK" as const,
      entityId: tasks["Soundboard Installation"].id,
    },
    {
      body: "Directive issued — Estates owns seating upgrade through committee review then GS/GO.",
      authorId: executiveId,
      entityType: "TASK" as const,
      entityId: tasks["Sanctuary Seating Upgrade"].id,
    },
    {
      body: "Sourcing quotes for pew replacements; will send for committee review when install is done.",
      authorId: secretaryId,
      entityType: "TASK" as const,
      entityId: tasks["Sanctuary Seating Upgrade"].id,
    },
  ];

  for (const spec of commentSpecs) {
    const existing = await prisma.comment.findFirst({
      where: { body: spec.body, entityId: spec.entityId },
    });
    if (!existing) {
      await prisma.comment.create({ data: spec });
    }
  }

  // 5. EVENTS & RSVPS
  const eventSpecs = [
    {
      title: "Estates Committee Review Meeting",
      description: "Monthly review of active renovations and projects",
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4, 17, 30),
      committeeId: estates.id,
      kind: "MEETING" as const,
      format: "IN_PERSON" as const,
      location: "Estates office",
    },
    {
      title: "Choir Rehearsal & Sound Check",
      description: "Joint rehearsal of main choir and instrumentalists in the auditorium",
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 18, 0),
      committeeId: worship.id,
      kind: "PROGRAM" as const,
      format: "IN_PERSON" as const,
      location: "Main auditorium",
    },
    {
      title: "Outreach Briefing Session",
      description: "Final coordination briefing for medical volunteers",
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6, 15, 0),
      committeeId: missions.id,
      kind: "WORKSHOP" as const,
      format: "HYBRID" as const,
      location: "Missions hall",
    },
    {
      title: "Site Working Visit — Sanctuary",
      description: "Walkthrough of seating upgrade progress with contractor",
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5, 10, 0),
      committeeId: estates.id,
      kind: "WORKING_VISIT" as const,
      format: "IN_PERSON" as const,
      location: "Sanctuary",
    },
    {
      title: "Presbytery General Assembly",
      description: "Quarterly review of all charter committees",
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 21, 9, 0),
      committeeId: committees[0].id,
      kind: "MEETING" as const,
      format: "IN_PERSON" as const,
    },
    {
      title: "Worship Committee Kickoff Meeting",
      description: "Kickoff for worship planning season",
      startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10, 18, 0),
      committeeId: worship.id,
      kind: "MEETING" as const,
      format: "IN_PERSON" as const,
      location: "Worship office",
    },
  ];

  const events: Record<string, any> = {};
  for (const spec of eventSpecs) {
    let existing = await prisma.event.findFirst({
      where: { committeeId: spec.committeeId, title: spec.title },
    });
    if (!existing) {
      existing = await prisma.event.create({ data: { ...spec, organizationId } });
    } else {
      existing = await prisma.event.update({
        where: { id: existing.id },
        data: {
          kind: spec.kind,
          format: spec.format,
          location: spec.location ?? null,
          description: spec.description,
        },
      });
    }
    events[spec.title] = existing;
  }

  // RSVPs
  const rsvpPairs = [
    { eventName: "Estates Committee Review Meeting", userId: chairId, status: "GOING" as const },
    { eventName: "Estates Committee Review Meeting", userId: secretaryId, status: "GOING" as const },
    { eventName: "Estates Committee Review Meeting", userId: memberId, status: "GOING" as const },
    { eventName: "Estates Committee Review Meeting", userId: executiveId, status: "GOING" as const },
    { eventName: "Choir Rehearsal & Sound Check", userId: chairId, status: "GOING" as const },
    { eventName: "Choir Rehearsal & Sound Check", userId: secretaryId, status: "GOING" as const },
    { eventName: "Choir Rehearsal & Sound Check", userId: memberId, status: "PENDING" as const },
    { eventName: "Outreach Briefing Session", userId: memberId, status: "GOING" as const },
    { eventName: "Outreach Briefing Session", userId: secretaryId, status: "GOING" as const }
  ];

  for (const r of rsvpPairs) {
    const ev = events[r.eventName];
    if (ev) {
      await prisma.eventRsvp.upsert({
        where: { eventId_userId: { eventId: ev.id, userId: r.userId } },
        create: { eventId: ev.id, userId: r.userId, status: r.status },
        update: { status: r.status }
      });
    }
  }

  // 6. MEETINGS & MINUTEPONTS & ATTENDANCE (linked to Events)
  const estatesReviewEvent = events["Estates Committee Review Meeting"];
  const worshipKickoffEvent = events["Worship Committee Kickoff Meeting"];

  let estatesMeeting = await prisma.meeting.findFirst({
    where: { committeeId: estates.id, title: "Estates Monthly Review" },
  });
  if (!estatesMeeting) {
    estatesMeeting = await prisma.meeting.create({
      data: {
        title: "Estates Monthly Review",
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
        committeeId: estates.id,
        eventId: estatesReviewEvent?.id ?? null,
        createdById: secretaryId,
        approved: true,
      },
    });
  } else if (estatesReviewEvent && !estatesMeeting.eventId) {
    estatesMeeting = await prisma.meeting.update({
      where: { id: estatesMeeting.id },
      data: { eventId: estatesReviewEvent.id },
    });
  }
  await prisma.attendance.createMany({
    data: [
      { meetingId: estatesMeeting.id, userId: chairId, status: "PRESENT" },
      { meetingId: estatesMeeting.id, userId: secretaryId, status: "PRESENT" },
      { meetingId: estatesMeeting.id, userId: memberId, status: "EXCUSED" },
    ],
    skipDuplicates: true,
  });
  const estatesMinutes = [
    "Reviewed sanctuary seating upgrade — project marked complete.",
    "Soundboard installation scheduled for next two weeks.",
    "Permit application still pending municipal review.",
  ];
  for (let i = 0; i < estatesMinutes.length; i++) {
    const exists = await prisma.minutePoint.findFirst({
      where: { meetingId: estatesMeeting.id, order: i + 1 },
    });
    if (!exists) {
      await prisma.minutePoint.create({
        data: { meetingId: estatesMeeting.id, order: i + 1, content: estatesMinutes[i] },
      });
    }
  }

  let worshipMeeting = await prisma.meeting.findFirst({
    where: { committeeId: worship.id, title: "Worship Committee Kickoff Meeting" },
  });
  if (!worshipMeeting) {
    worshipMeeting = await prisma.meeting.create({
      data: {
        title: "Worship Committee Kickoff Meeting",
        date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10),
        committeeId: worship.id,
        eventId: worshipKickoffEvent?.id ?? null,
        createdById: secretaryId,
        approved: true,
      },
    });
  } else if (worshipKickoffEvent && !worshipMeeting.eventId) {
    worshipMeeting = await prisma.meeting.update({
      where: { id: worshipMeeting.id },
      data: { eventId: worshipKickoffEvent.id },
    });
  }
  await prisma.attendance.createMany({
    data: [
      { meetingId: worshipMeeting.id, userId: chairId, status: "PRESENT" },
      { meetingId: worshipMeeting.id, userId: secretaryId, status: "PRESENT" },
      { meetingId: worshipMeeting.id, userId: memberId, status: "PRESENT" },
    ],
    skipDuplicates: true,
  });
  const worshipMinutes = [
    "Cantata dates finalized for December 20th and 21st.",
    "Secretary to draft rehearsal schedules and invite choral groups.",
    "Guest instrumentalists list approved."
  ];
  for (let i = 0; i < worshipMinutes.length; i++) {
    const exists = await prisma.minutePoint.findFirst({
      where: { meetingId: worshipMeeting.id, order: i + 1 },
    });
    if (!exists) {
      await prisma.minutePoint.create({
        data: { meetingId: worshipMeeting.id, order: i + 1, content: worshipMinutes[i] },
      });
    }
  }

  // 7. TIMELINE GOALS
  const timelineSpecs = [
    {
      title: "Sanctuary Renovation Phase 2",
      startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 2, 1),
      progress: 65,
      committeeId: estates.id,
    },
    {
      title: "Youth Center Renovation",
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 3, 1),
      progress: 10,
      committeeId: estates.id,
    },
    {
      title: "Annual Media Campaign",
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 2, 15),
      progress: 30,
      committeeId: media.id,
    },
    {
      title: "Cantata Rehearsals",
      startDate: new Date(now.getFullYear(), now.getMonth(), 1),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 30),
      progress: 40,
      committeeId: worship.id,
    },
    {
      title: "Outreach Logistics Planning",
      startDate: new Date(now.getFullYear(), now.getMonth(), 5),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 15),
      progress: 50,
      committeeId: missions.id,
    }
  ];

  for (const spec of timelineSpecs) {
    const existing = await prisma.timelineGoal.findFirst({
      where: { committeeId: spec.committeeId, title: spec.title },
    });
    if (!existing) {
      await prisma.timelineGoal.create({ data: spec });
    }
  }

  // 8. COMMITTEE FEEDBACK
  const feedbackSpecs = [
    {
      userId: secretaryId,
      committeeId: estates.id,
      type: "ISSUE" as const,
      message: "The sanctuary roof has a minor leak near the choir loft that needs quick fixing before the next rains.",
      status: "PENDING" as const,
    },
    {
      userId: memberId,
      committeeId: estates.id,
      type: "SUGGESTION" as const,
      message: "We should introduce digital projection screens behind the pulpit for better scripture rendering during services.",
      status: "REVIEWED" as const,
    },
    {
      userId: chairId,
      committeeId: worship.id,
      type: "SUGGESTION" as const,
      message: "The choir members have requested a dedicated locker or storage space in the vestry for robes and hymnals.",
      status: "PENDING" as const,
    }
  ];

  for (const spec of feedbackSpecs) {
    const existing = await prisma.committeeFeedback.findFirst({
      where: { userId: spec.userId, committeeId: spec.committeeId, message: spec.message },
    });
    if (!existing) {
      await prisma.committeeFeedback.create({ data: spec });
    }
  }

  // 9. LIBRARY DOCUMENTS
  const documentSpecs = [
    {
      title: "Estates & Projects — Terms of Reference",
      tag: "TOR" as const,
      source: "CREATED" as const,
      body: `<h2>Terms of Reference</h2>
<p><strong>Committee:</strong> Estates &amp; Projects</p>
<p><strong>Effective date:</strong> 2026-01-01</p>
<h3>Purpose</h3>
<p>Oversee parish buildings, grounds, and capital works; ensure safe, functional facilities for worship and ministry.</p>
<h3>Scope</h3>
<p>Sanctuary, halls, grounds, utilities, and approved renovation projects within budget.</p>
<h3>Responsibilities</h3>
<ol>
<li>Inspect facilities quarterly and log defects</li>
<li>Plan and execute approved capital projects</li>
<li>Coordinate contractors and volunteer work parties</li>
<li>Report progress and risks to the Presbytery</li>
<li>Maintain an asset and maintenance register</li>
</ol>
<h3>Reporting to governance</h3>
<p>Submit status updates at Presbytery meetings; escalate blocked work promptly.</p>`,
      committeeId: estates.id,
      uploadedById: chairId,
      organizationId,
    },
    {
      title: "Estates Q1 Infrastructure Report",
      tag: "REPORT" as const,
      source: "CREATED" as const,
      body: "Comprehensive report of the structural integrity and inventory audit of all parish buildings.",
      committeeId: estates.id,
      uploadedById: chairId,
      organizationId,
    },
    {
      title: "Church Music & Liturgy Guidelines 2026",
      tag: "POLICY" as const,
      source: "CREATED" as const,
      body: "Official guidelines for liturgical responses, choir rehearsals, and special event music coordination.",
      committeeId: worship.id,
      uploadedById: chairId,
      organizationId,
    },
    {
      title: "Rural Health Medical Outreach Project Charter",
      tag: "BRIEF" as const,
      source: "CREATED" as const,
      body: "Project charter outlining targets, volunteers, legal releases, and budget breakdown for the outreach.",
      committeeId: missions.id,
      uploadedById: memberId,
      organizationId,
    }
  ];

  for (const spec of documentSpecs) {
    const existing = await prisma.libraryDocument.findFirst({
      where: { title: spec.title, committeeId: spec.committeeId },
    });
    if (!existing) {
      await prisma.libraryDocument.create({ data: spec });
    }
  }

  // 10. ACTIVITY LOGS
  const activitySpecs = [
    {
      entityType: "TASK" as const,
      entityId: tasks["Soundboard Installation"].id,
      action: "STATUS_UPDATED",
      actorId: secretaryId,
      metadata: { title: "Soundboard Installation", status: "IN_PROGRESS" },
    },
    {
      entityType: "TASK" as const,
      entityId: tasks["Sanctuary Seating Upgrade"].id,
      action: "STATUS_UPDATED",
      actorId: executiveId,
      metadata: {
        title: "Sanctuary Seating Upgrade",
        status: "IN_PROGRESS",
        workClass: "DIRECTIVE",
      },
    },
    {
      entityType: "TASK" as const,
      entityId: tasks["Sanctuary Seating Upgrade"].id,
      action: "CREATED",
      actorId: executiveId,
      metadata: { title: "Sanctuary Seating Upgrade", workClass: "DIRECTIVE" },
    },
  ];

  for (const spec of activitySpecs) {
    const existing = await prisma.activityLog.findFirst({
      where: { entityType: spec.entityType, entityId: spec.entityId, action: spec.action },
    });
    if (!existing) {
      await prisma.activityLog.create({ data: spec });
    }
  }
}

async function main() {
  if (RESET) {
    console.info("SEED_RESET enabled — wiping database before seeding…");
    await resetDatabase();
  }

  const org = await ensureIcgOrg();
  const committees = await ensureCommittees(org.id);
  const supervisoryGroup = await ensureSupervisoryGroup(org.id);
  const verifiedAt = new Date();
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const users: Record<string, { id: string; email: string }> = {};
  for (const spec of SEED_USERS) {
    const user = await ensureUser(spec, passwordHash, verifiedAt);
    users[spec.key] = { id: user.id, email: user.email };

    await ensureOrgMembership(org.id, user.id, spec.role);

    if (spec.supervisoryHead) {
      await ensureSupervisoryMembership(user.id, supervisoryGroup.id, {
        isHead: true,
        title: "HEAD",
        customTitle: "General Overseer",
        canViewAll: true,
        canApproveOptional: true,
      });
    } else if (spec.supervisorySecretary) {
      await ensureSupervisoryMembership(user.id, supervisoryGroup.id, {
        title: "SECRETARY",
        customTitle: "General Secretary",
        canViewAll: true,
        canApproveOptional: false,
      });
    } else if (spec.supervisoryMember) {
      await ensureSupervisoryMembership(user.id, supervisoryGroup.id, {
        title: "MEMBER",
      });
    }
  }

  await prisma.platformAdmin.upsert({
    where: { userId: users.admin.id },
    create: { userId: users.admin.id },
    update: {},
  });

  const getComm = (letter: string) =>
    committees.find((c) => c.charterLetter === letter)!;
  const estates = getComm("c");
  const media = getComm("e");
  const finance = getComm("a");
  const worship = getComm("g");
  const missions = getComm("b");
  const youth = getComm("j");
  const itComm = getComm("f");
  const disciplinary = getComm("d");

  await ensureMembership(users.chair.id, estates.id, "CHAIR");
  await ensureMembership(users.chair.id, worship.id, "CHAIR");
  await ensureMembership(users.chair.id, media.id, "MEMBER");
  await ensureMembership(users.chair.id, finance.id, "MEMBER");

  await ensureMembership(users.secretary.id, estates.id, "SECRETARY");
  await ensureMembership(users.secretary.id, worship.id, "SECRETARY");
  await ensureMembership(users.secretary.id, itComm.id, "MEMBER");
  await ensureMembership(users.secretary.id, disciplinary.id, "MEMBER");

  await ensureMembership(users.member.id, estates.id, "MEMBER");
  await ensureMembership(users.member.id, missions.id, "CHAIR");
  await ensureMembership(users.member.id, worship.id, "MEMBER");
  await ensureMembership(users.member.id, youth.id, "MEMBER");

  await ensureDemoContent({
    committees,
    users,
    organizationId: org.id,
  });

  console.log("Seed complete (idempotent):", {
    mode: RESET ? "reset" : "ensure",
    organization: "ICGC",
    committees: committees.length,
    users: SEED_USERS.length,
    password: SEED_PASSWORD,
    login: Object.fromEntries(
      SEED_USERS.map((u) => [u.key, users[u.key].email]),
    ),
    tip: "Login → pick ICGC. Platform Super: admin@unitycommit.org → /super",
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
