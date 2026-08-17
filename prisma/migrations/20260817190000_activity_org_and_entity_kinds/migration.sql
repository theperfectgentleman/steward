-- AlterEnum
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'EVENT';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'INVITE';
ALTER TYPE "EntityType" ADD VALUE IF NOT EXISTS 'STRUCTURE';

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActivityLog_organizationId_createdAt_idx" ON "ActivityLog"("organizationId", "createdAt");
