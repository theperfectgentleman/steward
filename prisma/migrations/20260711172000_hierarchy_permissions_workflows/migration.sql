-- Migrate UserRole enum values before swap
CREATE TYPE "UserRole_new" AS ENUM ('SUPER_ADMIN', 'SYSTEM_ADMIN', 'CHURCH_EXECUTIVE', 'COMMITTEE_PARTICIPANT');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING (
  CASE "role"::text
    WHEN 'COMMITTEE_CHAIRPERSON' THEN 'COMMITTEE_PARTICIPANT'
    WHEN 'COMMITTEE_SECRETARY' THEN 'COMMITTEE_PARTICIPANT'
    WHEN 'COMMITTEE_MEMBER' THEN 'COMMITTEE_PARTICIPANT'
    ELSE "role"::text
  END::"UserRole_new"
);
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'COMMITTEE_PARTICIPANT';

DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- New enums
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETE');
CREATE TYPE "AssignmentSource" AS ENUM ('PRESBYTERY', 'COMMITTEE_REFERRAL');
CREATE TYPE "AssignmentStatus" AS ENUM ('DRAFT', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'IN_REVIEW', 'RETURNED', 'CHAIR_APPROVED', 'CLOSED', 'CANCELLED');
CREATE TYPE "AssignmentPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');
CREATE TYPE "EntityType" AS ENUM ('ASSIGNMENT', 'PROJECT', 'TASK');

-- Presbytery group
CREATE TABLE "PresbyteryGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Presbytery',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PresbyteryGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PresbyteryMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "isHead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PresbyteryMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PresbyteryMember_userId_key" ON "PresbyteryMember"("userId");
ALTER TABLE "PresbyteryMember" ADD CONSTRAINT "PresbyteryMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PresbyteryMember" ADD CONSTRAINT "PresbyteryMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PresbyteryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Project
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "committeeId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Project_assignmentId_key" ON "Project"("assignmentId");
ALTER TABLE "Project" ADD CONSTRAINT "Project_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Assignment
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" "AssignmentSource" NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "AssignmentPriority" NOT NULL DEFAULT 'NORMAL',
    "createdById" TEXT NOT NULL,
    "targetCommitteeId" TEXT NOT NULL,
    "sourceCommitteeId" TEXT,
    "parentAssignmentId" TEXT,
    "rootTaskId" TEXT,
    "dueDate" TIMESTAMP(3),
    "returnComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Assignment_rootTaskId_key" ON "Assignment"("rootTaskId");
CREATE INDEX "Assignment_targetCommitteeId_status_idx" ON "Assignment"("targetCommitteeId", "status");
CREATE INDEX "Assignment_createdById_status_idx" ON "Assignment"("createdById", "status");
CREATE INDEX "Assignment_status_dueDate_idx" ON "Assignment"("status", "dueDate");

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_targetCommitteeId_fkey" FOREIGN KEY ("targetCommitteeId") REFERENCES "Committee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_sourceCommitteeId_fkey" FOREIGN KEY ("sourceCommitteeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_parentAssignmentId_fkey" FOREIGN KEY ("parentAssignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_rootTaskId_fkey" FOREIGN KEY ("rootTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Task projectId
ALTER TABLE "Task" ADD COLUMN "projectId" TEXT;
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Task_committeeId_assignedToId_status_idx" ON "Task"("committeeId", "assignedToId", "status");
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Comments, Documents, ActivityLog
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Comment_entityType_entityId_createdAt_idx" ON "Comment"("entityType", "entityId", "createdAt");
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Document_entityType_entityId_idx" ON "Document"("entityType", "entityId");
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityLog_entityType_entityId_createdAt_idx" ON "ActivityLog"("entityType", "entityId", "createdAt");
CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt");
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
