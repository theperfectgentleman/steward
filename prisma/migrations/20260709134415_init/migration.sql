-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'COMMITTEE_MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Committee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "charterLetter" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "budget" REAL,
    "reportingFrequency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CommitteeMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'MEMBER',
    CONSTRAINT "CommitteeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommitteeMember_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "dueDate" DATETIME,
    "committeeId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "committeeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Event_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventRsvp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "committeeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MinutePoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "meetingId" TEXT NOT NULL,
    CONSTRAINT "MinutePoint_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNMARKED',
    CONSTRAINT "Attendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimelineGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "committeeId" TEXT NOT NULL,
    CONSTRAINT "TimelineGoal_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Committee_charterLetter_key" ON "Committee"("charterLetter");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMember_userId_committeeId_key" ON "CommitteeMember"("userId", "committeeId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRsvp_eventId_userId_key" ON "EventRsvp"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_meetingId_userId_key" ON "Attendance"("meetingId", "userId");
