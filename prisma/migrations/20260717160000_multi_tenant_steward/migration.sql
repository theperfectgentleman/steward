-- Steward multi-tenant upgrade: Organization, Supervisory, Reports, RBAC foundations

-- 1) New enums
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "OrganizationMemberRole" AS ENUM ('ORG_ADMIN', 'ORG_TECH', 'ORG_PARTICIPANT');
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'FINAL');
CREATE TYPE "InviteTargetType" AS ENUM ('COMMITTEE', 'SUPERVISORY', 'ORG_ADMIN');

-- Expand CommitteeTitle / EntityType (committed separately from later DDL when needed)
ALTER TYPE "CommitteeTitle" ADD VALUE 'DEPUTY';
ALTER TYPE "CommitteeTitle" ADD VALUE 'CUSTOM';
ALTER TYPE "EntityType" ADD VALUE 'REPORT';

-- 2) Remap UserRole via new enum
CREATE TYPE "UserRole_new" AS ENUM ('ORG_ADMIN', 'ORG_TECH', 'ORG_PARTICIPANT');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING (
    CASE "role"::text
      WHEN 'SUPER_ADMIN' THEN 'ORG_ADMIN'
      WHEN 'SYSTEM_ADMIN' THEN 'ORG_TECH'
      WHEN 'CHURCH_EXECUTIVE' THEN 'ORG_PARTICIPANT'
      WHEN 'COMMITTEE_PARTICIPANT' THEN 'ORG_PARTICIPANT'
      ELSE 'ORG_PARTICIPANT'
    END::"UserRole_new"
  );
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ORG_PARTICIPANT'::"UserRole";

-- 3) Remap AssignmentSource
CREATE TYPE "AssignmentSource_new" AS ENUM ('SUPERVISORY', 'COMMITTEE_REFERRAL');
ALTER TABLE "Assignment"
  ALTER COLUMN "source" TYPE "AssignmentSource_new"
  USING (
    CASE "source"::text
      WHEN 'PRESBYTERY' THEN 'SUPERVISORY'
      ELSE "source"::text
    END::"AssignmentSource_new"
  );
DROP TYPE "AssignmentSource";
ALTER TYPE "AssignmentSource_new" RENAME TO "AssignmentSource";

-- 4) Organization tables
CREATE TABLE "Organization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE "OrganizationSettings" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "supervisoryLabel" TEXT NOT NULL DEFAULT 'Supervisory Group',
  "committeeLabel" TEXT NOT NULL DEFAULT 'Committee',
  "committeeBudgetsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "allowCrossCommitteeRead" BOOLEAN NOT NULL DEFAULT false,
  "requireOversightOnSelfInitiated" BOOLEAN NOT NULL DEFAULT true,
  "allowSupervisoryAssignMembers" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings"("organizationId");

CREATE TABLE "OrganizationMembership" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "OrganizationMemberRole" NOT NULL DEFAULT 'ORG_PARTICIPANT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");
CREATE INDEX "OrganizationMembership_userId_idx" ON "OrganizationMembership"("userId");

CREATE TABLE "PlatformAdmin" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlatformAdmin_userId_key" ON "PlatformAdmin"("userId");

CREATE TABLE "RoleTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "description" TEXT,
  "capabilities" JSONB NOT NULL DEFAULT '{}',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "RoleTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoleTemplate_organizationId_key_key" ON "RoleTemplate"("organizationId", "key");

CREATE TABLE "Report" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
  "authorId" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewComment" TEXT,
  "submittedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Report_organizationId_status_idx" ON "Report"("organizationId", "status");
CREATE INDEX "Report_projectId_status_idx" ON "Report"("projectId", "status");

-- 5) Seed ICGC org from existing demo data
INSERT INTO "Organization" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES ('org_icgc_demo', 'ICGC', 'icgc', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "OrganizationSettings" (
  "id", "organizationId", "supervisoryLabel", "committeeLabel",
  "committeeBudgetsEnabled", "allowCrossCommitteeRead",
  "requireOversightOnSelfInitiated", "allowSupervisoryAssignMembers", "updatedAt"
)
SELECT
  'orgset_icgc_demo',
  'org_icgc_demo',
  'Presbytery',
  'Committee',
  COALESCE((SELECT "committeeBudgetsEnabled" FROM "AppSettings" WHERE "id" = 'default'), false),
  false,
  true,
  true,
  CURRENT_TIMESTAMP;

-- Memberships from users
INSERT INTO "OrganizationMembership" ("id", "organizationId", "userId", "role", "createdAt", "updatedAt")
SELECT
  'om_' || u."id",
  'org_icgc_demo',
  u."id",
  CASE u."role"::text
    WHEN 'ORG_ADMIN' THEN 'ORG_ADMIN'::"OrganizationMemberRole"
    WHEN 'ORG_TECH' THEN 'ORG_TECH'::"OrganizationMemberRole"
    ELSE 'ORG_PARTICIPANT'::"OrganizationMemberRole"
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u;

-- Platform admin: first ORG_ADMIN user (Joseph / admin)
INSERT INTO "PlatformAdmin" ("id", "userId", "createdAt")
SELECT 'padmin_icgc_seed', u."id", CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" = 'ORG_ADMIN'
ORDER BY u."createdAt" ASC
LIMIT 1;

-- Default role templates for ICGC
INSERT INTO "RoleTemplate" ("id", "organizationId", "name", "key", "description", "capabilities", "sortOrder") VALUES
('rt_icgc_chair', 'org_icgc_demo', 'Chair', 'CHAIR', 'Committee chairperson', '{"editTasks":true,"logMinutes":true,"approveMinutes":true,"invite":true,"submitReports":true}', 1),
('rt_icgc_deputy', 'org_icgc_demo', 'Deputy', 'DEPUTY', 'Deputy chair', '{"editTasks":true,"logMinutes":true,"submitReports":true}', 2),
('rt_icgc_secretary', 'org_icgc_demo', 'Secretary', 'SECRETARY', 'Committee secretary', '{"editTasks":true,"logMinutes":true,"submitReports":true}', 3),
('rt_icgc_member', 'org_icgc_demo', 'Member', 'MEMBER', 'Committee member', '{"updateAssignedTasks":true}', 4);

-- 6) Rename Presbytery → Supervisory
ALTER TABLE "PresbyteryMember" DROP CONSTRAINT IF EXISTS "PresbyteryMember_groupId_fkey";
ALTER TABLE "PresbyteryMember" DROP CONSTRAINT IF EXISTS "PresbyteryMember_userId_fkey";
ALTER TABLE "PresbyteryGroup" RENAME TO "SupervisoryGroup";
ALTER TABLE "PresbyteryMember" RENAME TO "SupervisoryMember";

ALTER TABLE "SupervisoryGroup" ADD COLUMN "organizationId" TEXT;
UPDATE "SupervisoryGroup" SET "organizationId" = 'org_icgc_demo';
ALTER TABLE "SupervisoryGroup" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "SupervisoryMember" DROP CONSTRAINT IF EXISTS "PresbyteryMember_userId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SupervisoryMember_userId_groupId_key" ON "SupervisoryMember"("userId", "groupId");
CREATE INDEX IF NOT EXISTS "SupervisoryMember_groupId_idx" ON "SupervisoryMember"("groupId");
CREATE INDEX IF NOT EXISTS "SupervisoryGroup_organizationId_idx" ON "SupervisoryGroup"("organizationId");

ALTER TABLE "SupervisoryGroup"
  ADD CONSTRAINT "SupervisoryGroup_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupervisoryMember"
  ADD CONSTRAINT "SupervisoryMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupervisoryMember"
  ADD CONSTRAINT "SupervisoryMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "SupervisoryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 7) Committee org scoping
ALTER TABLE "Committee" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Committee" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
UPDATE "Committee" SET "organizationId" = 'org_icgc_demo';
ALTER TABLE "Committee" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Committee" DROP CONSTRAINT IF EXISTS "Committee_charterLetter_key";
ALTER TABLE "Committee" ALTER COLUMN "charterLetter" DROP NOT NULL;
CREATE UNIQUE INDEX "Committee_organizationId_charterLetter_key" ON "Committee"("organizationId", "charterLetter");
CREATE INDEX "Committee_organizationId_idx" ON "Committee"("organizationId");

ALTER TABLE "Committee"
  ADD CONSTRAINT "Committee_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8) CommitteeMember customTitle
ALTER TABLE "CommitteeMember" ADD COLUMN "customTitle" TEXT;

-- 9) Invite upgrades
ALTER TABLE "Invite" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Invite" ADD COLUMN "targetType" "InviteTargetType" NOT NULL DEFAULT 'COMMITTEE';
ALTER TABLE "Invite" ADD COLUMN "customTitle" TEXT;
ALTER TABLE "Invite" ADD COLUMN "isSupervisoryHead" BOOLEAN NOT NULL DEFAULT false;
UPDATE "Invite" SET "organizationId" = 'org_icgc_demo';
ALTER TABLE "Invite" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Invite" ALTER COLUMN "committeeId" DROP NOT NULL;
CREATE INDEX "Invite_organizationId_idx" ON "Invite"("organizationId");
ALTER TABLE "Invite"
  ADD CONSTRAINT "Invite_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 10) LibraryDocument org
ALTER TABLE "LibraryDocument" ADD COLUMN "organizationId" TEXT;
UPDATE "LibraryDocument" SET "organizationId" = 'org_icgc_demo';
CREATE INDEX "LibraryDocument_organizationId_tag_createdAt_idx" ON "LibraryDocument"("organizationId", "tag", "createdAt");
ALTER TABLE "LibraryDocument"
  ADD CONSTRAINT "LibraryDocument_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 11) Report FKs
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 12) Org membership / platform FKs
ALTER TABLE "OrganizationSettings"
  ADD CONSTRAINT "OrganizationSettings_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership"
  ADD CONSTRAINT "OrganizationMembership_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership"
  ADD CONSTRAINT "OrganizationMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformAdmin"
  ADD CONSTRAINT "PlatformAdmin_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleTemplate"
  ADD CONSTRAINT "RoleTemplate_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 13) Drop singleton AppSettings (migrated into OrganizationSettings)
DROP TABLE IF EXISTS "AppSettings";
