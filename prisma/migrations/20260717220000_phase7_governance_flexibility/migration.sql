-- CreateEnum
CREATE TYPE "SupervisoryTitle" AS ENUM ('HEAD', 'SECRETARY', 'MEMBER', 'CUSTOM');
CREATE TYPE "ScheduleKind" AS ENUM ('MEETING', 'EVENT');
CREATE TYPE "ScheduleFormat" AS ENUM ('IN_PERSON', 'VIRTUAL', 'HYBRID');
CREATE TYPE "MessageThreadKind" AS ENUM ('DIRECT', 'COMMITTEE', 'GROUP');

-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'LIBRARY_DOCUMENT';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'DOCUMENT';

-- OrganizationSettings
ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "approvalStack" JSONB NOT NULL DEFAULT '[]';

-- SupervisoryMember titles
ALTER TABLE "SupervisoryMember" ADD COLUMN IF NOT EXISTS "title" "SupervisoryTitle" NOT NULL DEFAULT 'MEMBER';
ALTER TABLE "SupervisoryMember" ADD COLUMN IF NOT EXISTS "customTitle" TEXT;
ALTER TABLE "SupervisoryMember" ADD COLUMN IF NOT EXISTS "roleTemplateKey" TEXT;
ALTER TABLE "SupervisoryMember" ADD COLUMN IF NOT EXISTS "canViewAll" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SupervisoryMember" ADD COLUMN IF NOT EXISTS "canApproveOptional" BOOLEAN NOT NULL DEFAULT false;

UPDATE "SupervisoryMember" SET "title" = 'HEAD', "canViewAll" = true, "canApproveOptional" = true WHERE "isHead" = true;

-- Assignment cascade
ALTER TABLE "Assignment" ALTER COLUMN "targetCommitteeId" DROP NOT NULL;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "assigneeUserId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "accountableOwnerId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN IF NOT EXISTS "approvalStepIndex" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Assignment_assigneeUserId_status_idx" ON "Assignment"("assigneeUserId", "status");
CREATE INDEX IF NOT EXISTS "Assignment_accountableOwnerId_status_idx" ON "Assignment"("accountableOwnerId", "status");

DO $$ BEGIN
  ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_accountableOwnerId_fkey" FOREIGN KEY ("accountableOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task dependencies
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "estimatedDays" DOUBLE PRECISION;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "dependsOnTaskId" TEXT;
CREATE INDEX IF NOT EXISTS "Task_dependsOnTaskId_idx" ON "Task"("dependsOnTaskId");
DO $$ BEGIN
  ALTER TABLE "Task" ADD CONSTRAINT "Task_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Event enrichment
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "kind" "ScheduleKind" NOT NULL DEFAULT 'EVENT';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "format" "ScheduleFormat" NOT NULL DEFAULT 'IN_PERSON';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "joinUrl" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "agenda" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
ALTER TABLE "Event" ALTER COLUMN "committeeId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "Event_committeeId_startDate_idx" ON "Event"("committeeId", "startDate");
CREATE INDEX IF NOT EXISTS "Event_organizationId_startDate_idx" ON "Event"("organizationId", "startDate");
CREATE INDEX IF NOT EXISTS "Event_kind_startDate_idx" ON "Event"("kind", "startDate");
DO $$ BEGIN
  ALTER TABLE "Event" ADD CONSTRAINT "Event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Meeting link to event; committee optional
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "Meeting" ALTER COLUMN "committeeId" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Meeting_eventId_key" ON "Meeting"("eventId");
DO $$ BEGIN
  ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AgendaItem
CREATE TABLE IF NOT EXISTS "AgendaItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "assignmentId" TEXT,
    "reportId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgendaItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AgendaItem_eventId_order_idx" ON "AgendaItem"("eventId", "order");
CREATE INDEX IF NOT EXISTS "AgendaItem_assignmentId_idx" ON "AgendaItem"("assignmentId");
DO $$ BEGIN
  ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Messaging
CREATE TABLE IF NOT EXISTS "MessageThread" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "MessageThreadKind" NOT NULL DEFAULT 'DIRECT',
    "subject" TEXT,
    "committeeId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MessageThread_organizationId_updatedAt_idx" ON "MessageThread"("organizationId", "updatedAt");
CREATE INDEX IF NOT EXISTS "MessageThread_committeeId_idx" ON "MessageThread"("committeeId");
DO $$ BEGIN
  ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MessageThread" ADD CONSTRAINT "MessageThread_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "MessageParticipant" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageParticipant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MessageParticipant_threadId_userId_key" ON "MessageParticipant"("threadId", "userId");
CREATE INDEX IF NOT EXISTS "MessageParticipant_userId_idx" ON "MessageParticipant"("userId");
DO $$ BEGIN
  ALTER TABLE "MessageParticipant" ADD CONSTRAINT "MessageParticipant_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MessageParticipant" ADD CONSTRAINT "MessageParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
