-- Tenant-key work objects: required organizationId on Task/Event/LibraryDocument.
-- Task.committeeId becomes nullable so PERSONAL work can sit at org scope.

-- 1) Task.organizationId (backfill from committee, then require)
ALTER TABLE "Task" ADD COLUMN "organizationId" TEXT;

UPDATE "Task" AS t
SET "organizationId" = c."organizationId"
FROM "Committee" AS c
WHERE t."committeeId" = c."id"
  AND t."organizationId" IS NULL;

DELETE FROM "Task" WHERE "organizationId" IS NULL;

ALTER TABLE "Task" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Task"
  ADD CONSTRAINT "Task_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Task_organizationId_status_idx" ON "Task"("organizationId", "status");
CREATE INDEX "Task_organizationId_workClass_status_idx" ON "Task"("organizationId", "workClass", "status");

-- 2) Task.committeeId nullable; surviving rows SetNull on committee delete
ALTER TABLE "Task" ALTER COLUMN "committeeId" DROP NOT NULL;

ALTER TABLE "Task" DROP CONSTRAINT "Task_committeeId_fkey";
ALTER TABLE "Task"
  ADD CONSTRAINT "Task_committeeId_fkey"
  FOREIGN KEY ("committeeId") REFERENCES "Committee"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) Event.organizationId required (backfill from existing field or committee)
UPDATE "Event" AS e
SET "organizationId" = c."organizationId"
FROM "Committee" AS c
WHERE e."committeeId" = c."id"
  AND e."organizationId" IS NULL;

DELETE FROM "Event" WHERE "organizationId" IS NULL;

ALTER TABLE "Event" ALTER COLUMN "organizationId" SET NOT NULL;

-- 4) LibraryDocument.organizationId required (same backfill)
UPDATE "LibraryDocument" AS d
SET "organizationId" = c."organizationId"
FROM "Committee" AS c
WHERE d."committeeId" = c."id"
  AND d."organizationId" IS NULL;

DELETE FROM "LibraryDocument" WHERE "organizationId" IS NULL;

ALTER TABLE "LibraryDocument" ALTER COLUMN "organizationId" SET NOT NULL;
