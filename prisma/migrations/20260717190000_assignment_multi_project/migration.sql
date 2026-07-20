-- AlterTable
DROP INDEX IF EXISTS "Project_assignmentId_key";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Project_assignmentId_idx" ON "Project"("assignmentId");
