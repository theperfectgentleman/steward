-- Phase 3: Task workClass + dual approval stacks
-- Supersedes prisma/phase3-additive.sql

DO $$ BEGIN
  CREATE TYPE "TaskWorkClass" AS ENUM ('DIRECTIVE', 'COMMITTEE', 'PERSONAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "workClass" "TaskWorkClass" NOT NULL DEFAULT 'COMMITTEE';
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "approvalStepIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "returnComment" TEXT;

ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "directiveApprovalStack" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "OrganizationSettings" ADD COLUMN IF NOT EXISTS "committeeApprovalStack" JSONB NOT NULL DEFAULT '[]';
