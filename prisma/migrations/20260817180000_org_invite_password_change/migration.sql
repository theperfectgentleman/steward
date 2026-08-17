ALTER TYPE "InviteTargetType" ADD VALUE IF NOT EXISTS 'ORGANIZATION';

ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Invite" ADD COLUMN "orgRole" "OrganizationMemberRole";
