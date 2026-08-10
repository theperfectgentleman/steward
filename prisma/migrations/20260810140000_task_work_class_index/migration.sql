-- Sync schema drift: supervisory constraint names, default label, task index

DO $$ BEGIN
  ALTER TABLE "SupervisoryGroup" RENAME CONSTRAINT "PresbyteryGroup_pkey" TO "SupervisoryGroup_pkey";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupervisoryMember" RENAME CONSTRAINT "PresbyteryMember_pkey" TO "SupervisoryMember_pkey";
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE "SupervisoryGroup" ALTER COLUMN "name" SET DEFAULT 'Supervisory Group';

CREATE INDEX IF NOT EXISTS "Task_workClass_status_idx" ON "Task"("workClass", "status");
