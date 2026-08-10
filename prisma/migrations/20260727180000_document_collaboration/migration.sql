-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "NativeDocKind" AS ENUM ('DOCUMENT', 'SPREADSHEET', 'PRESENTATION');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentMemberRole" AS ENUM ('OWNER', 'EDITOR', 'REVIEWER', 'APPROVER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "LibraryDocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'RETURNED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable LibraryDocument
ALTER TABLE "LibraryDocument" ADD COLUMN IF NOT EXISTS "kind" "NativeDocKind" NOT NULL DEFAULT 'DOCUMENT';
ALTER TABLE "LibraryDocument" ADD COLUMN IF NOT EXISTS "status" "LibraryDocumentStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "LibraryDocument" ADD COLUMN IF NOT EXISTS "contentJson" JSONB;
ALTER TABLE "LibraryDocument" ADD COLUMN IF NOT EXISTS "crdtState" BYTEA;
ALTER TABLE "LibraryDocument" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "LibraryDocument_organizationId_kind_createdAt_idx"
  ON "LibraryDocument"("organizationId", "kind", "createdAt");
CREATE INDEX IF NOT EXISTS "LibraryDocument_organizationId_status_createdAt_idx"
  ON "LibraryDocument"("organizationId", "status", "createdAt");

-- DocumentVersion table if missing
CREATE TABLE IF NOT EXISTS "DocumentVersion" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "contentJson" JSONB NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DocumentVersion_documentId_createdAt_idx"
  ON "DocumentVersion"("documentId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "LibraryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- DocumentMember
CREATE TABLE IF NOT EXISTS "DocumentMember" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "DocumentMemberRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentMember_documentId_userId_key" ON "DocumentMember"("documentId", "userId");
CREATE INDEX IF NOT EXISTS "DocumentMember_userId_idx" ON "DocumentMember"("userId");
CREATE INDEX IF NOT EXISTS "DocumentMember_documentId_role_idx" ON "DocumentMember"("documentId", "role");

DO $$ BEGIN
  ALTER TABLE "DocumentMember" ADD CONSTRAINT "DocumentMember_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "LibraryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "DocumentMember" ADD CONSTRAINT "DocumentMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- DocumentLink
CREATE TABLE IF NOT EXISTS "DocumentLink" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "entityType" "EntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentLink_documentId_entityType_entityId_key"
  ON "DocumentLink"("documentId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "DocumentLink_entityType_entityId_idx" ON "DocumentLink"("entityType", "entityId");

DO $$ BEGIN
  ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "LibraryDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
  ALTER TABLE "DocumentLink" ADD CONSTRAINT "DocumentLink_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Comment anchoring / threading
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "threadId" TEXT;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "anchorMarkId" TEXT;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "anchorText" TEXT;
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "Comment" ADD COLUMN IF NOT EXISTS "resolvedById" TEXT;

CREATE INDEX IF NOT EXISTS "Comment_threadId_createdAt_idx" ON "Comment"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "Comment_anchorMarkId_idx" ON "Comment"("anchorMarkId");

DO $$ BEGIN
  ALTER TABLE "Comment" ADD CONSTRAINT "Comment_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
