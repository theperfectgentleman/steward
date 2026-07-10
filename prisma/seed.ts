import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { Pool } from "pg";
import { COMMITTEE_CHARTER } from "../src/lib/committees";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.attendance.deleteMany();
  await prisma.minutePoint.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.eventRsvp.deleteMany();
  await prisma.event.deleteMany();
  await prisma.timelineGoal.deleteMany();
  await prisma.task.deleteMany();
  await prisma.committeeMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.committee.deleteMany();

  const committees = await Promise.all(
    COMMITTEE_CHARTER.map((c) =>
      prisma.committee.create({
        data: {
          charterLetter: c.letter,
          name: c.name,
          description: `${c.name} — church charter committee ${c.letter.toUpperCase()}`,
          budget: 5000 + Math.floor(Math.random() * 15000),
          reportingFrequency: "Monthly",
        },
      }),
    ),
  );

  const admin = await prisma.user.create({
    data: {
      name: "Joseph Osei",
      email: "admin@unitycommit.org",
      phone: "+233 24 000 0001",
      role: "SUPER_ADMIN",
    },
  });

  const executive = await prisma.user.create({
    data: {
      name: "Rev. General Overseer",
      email: "overseer@unitycommit.org",
      phone: "+233 24 000 0002",
      role: "CHURCH_EXECUTIVE",
    },
  });

  const chair = await prisma.user.create({
    data: {
      name: "Grace Mensah",
      email: "grace@unitycommit.org",
      phone: "+233 24 000 0003",
      role: "COMMITTEE_CHAIRPERSON",
    },
  });

  const secretary = await prisma.user.create({
    data: {
      name: "James Osei",
      email: "james@unitycommit.org",
      phone: "+233 24 000 0004",
      role: "COMMITTEE_SECRETARY",
    },
  });

  const member = await prisma.user.create({
    data: {
      name: "Ama Boateng",
      email: "ama@unitycommit.org",
      phone: "+233 24 000 0005",
      role: "COMMITTEE_MEMBER",
    },
  });

  const estates = committees.find((c) => c.charterLetter === "c")!;
  const media = committees.find((c) => c.charterLetter === "e")!;

  await prisma.committeeMember.createMany({
    data: [
      { userId: chair.id, committeeId: estates.id, title: "CHAIR" },
      { userId: secretary.id, committeeId: estates.id, title: "SECRETARY" },
      { userId: member.id, committeeId: estates.id, title: "MEMBER" },
      { userId: chair.id, committeeId: media.id, title: "MEMBER" },
    ],
  });

  const now = new Date();

  await prisma.task.createMany({
    data: [
      {
        title: "Soundboard Installation",
        description: "Install and test new sanctuary soundboard system",
        status: "IN_PROGRESS",
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14),
        committeeId: estates.id,
        assignedToId: secretary.id,
        createdById: chair.id,
      },
      {
        title: "Sanctuary Seating Upgrade",
        description: "Complete seating refurbishment project",
        status: "DONE",
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
        committeeId: estates.id,
        assignedToId: member.id,
        createdById: chair.id,
      },
      {
        title: "Permit Application Review",
        description: "Awaiting municipal approval for expansion",
        status: "BLOCKED",
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
        committeeId: estates.id,
        assignedToId: chair.id,
        createdById: chair.id,
      },
      {
        title: "Weekly Bulletin Design",
        status: "TODO",
        dueDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5),
        committeeId: media.id,
        assignedToId: member.id,
        createdById: chair.id,
      },
    ],
  });

  const meeting = await prisma.meeting.create({
    data: {
      title: "Estates Monthly Review",
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
      committeeId: estates.id,
      createdById: secretary.id,
      approved: false,
    },
  });

  await prisma.attendance.createMany({
    data: [
      { meetingId: meeting.id, userId: chair.id, status: "PRESENT" },
      { meetingId: meeting.id, userId: secretary.id, status: "PRESENT" },
      { meetingId: meeting.id, userId: member.id, status: "EXCUSED" },
    ],
  });

  await prisma.minutePoint.createMany({
    data: [
      {
        meetingId: meeting.id,
        order: 1,
        content: "Reviewed sanctuary seating upgrade — project marked complete.",
      },
      {
        meetingId: meeting.id,
        order: 2,
        content: "Soundboard installation scheduled for next two weeks.",
      },
      {
        meetingId: meeting.id,
        order: 3,
        content: "Permit application still pending municipal review.",
      },
    ],
  });

  await prisma.event.createMany({
    data: [
      {
        title: "Estates Committee Meeting",
        description: "Monthly progress review",
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10, 18, 0),
        committeeId: estates.id,
      },
      {
        title: "Media Team Planning Session",
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3, 10, 0),
        committeeId: media.id,
      },
      {
        title: "Presbytery Quarterly Review",
        description: "All committees report progress",
        startDate: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 21, 9, 0),
        committeeId: committees[0].id,
      },
    ],
  });

  await prisma.timelineGoal.createMany({
    data: [
      {
        title: "Sanctuary Renovation Phase 2",
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 3, 1),
        progress: 65,
        committeeId: estates.id,
      },
      {
        title: "Annual Media Campaign",
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 2, 15),
        progress: 30,
        committeeId: media.id,
      },
    ],
  });

  console.log("Seed complete:", {
    committees: committees.length,
    users: 5,
    demoLogin: {
      admin: admin.email,
      executive: executive.email,
      chair: chair.email,
      secretary: secretary.email,
      member: member.email,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
