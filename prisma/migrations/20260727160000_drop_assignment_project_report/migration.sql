-- Drop Assignment / Project / Report product path and related FKs

ALTER TABLE "AgendaItem" DROP CONSTRAINT IF EXISTS "AgendaItem_assignmentId_fkey";
DROP INDEX IF EXISTS "AgendaItem_assignmentId_idx";
ALTER TABLE "AgendaItem" DROP COLUMN IF EXISTS "assignmentId";
ALTER TABLE "AgendaItem" DROP COLUMN IF EXISTS "reportId";

ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_projectId_fkey";
DROP INDEX IF EXISTS "Task_projectId_idx";
ALTER TABLE "Task" DROP COLUMN IF EXISTS "projectId";

DROP TABLE IF EXISTS "Report";
DROP TABLE IF EXISTS "Project";
DROP TABLE IF EXISTS "Assignment";

ALTER TABLE "OrganizationSettings" DROP COLUMN IF EXISTS "approvalStack";

CREATE TYPE "EntityType_new" AS ENUM ('TASK', 'LIBRARY_DOCUMENT', 'DOCUMENT');

UPDATE "Comment" SET "entityType" = 'TASK' WHERE "entityType"::text IN ('ASSIGNMENT', 'PROJECT', 'REPORT');
UPDATE "Document" SET "entityType" = 'DOCUMENT' WHERE "entityType"::text IN ('ASSIGNMENT', 'PROJECT', 'REPORT');
UPDATE "ActivityLog" SET "entityType" = 'TASK' WHERE "entityType"::text IN ('ASSIGNMENT', 'PROJECT', 'REPORT');

ALTER TABLE "Comment" ALTER COLUMN "entityType" TYPE "EntityType_new" USING ("entityType"::text::"EntityType_new");
ALTER TABLE "Document" ALTER COLUMN "entityType" TYPE "EntityType_new" USING ("entityType"::text::"EntityType_new");
ALTER TABLE "ActivityLog" ALTER COLUMN "entityType" TYPE "EntityType_new" USING ("entityType"::text::"EntityType_new");

DROP TYPE "EntityType";
ALTER TYPE "EntityType_new" RENAME TO "EntityType";

DROP TYPE IF EXISTS "ProjectStatus";
DROP TYPE IF EXISTS "AssignmentSource";
DROP TYPE IF EXISTS "AssignmentStatus";
DROP TYPE IF EXISTS "AssignmentPriority";
DROP TYPE IF EXISTS "ReportStatus";