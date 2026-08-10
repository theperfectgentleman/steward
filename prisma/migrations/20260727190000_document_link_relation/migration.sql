-- CreateEnum
CREATE TYPE "DocumentLinkRelation" AS ENUM ('ABOUT', 'EVIDENCE', 'PART_OF');

-- AlterTable
ALTER TABLE "DocumentLink" ADD COLUMN "relation" "DocumentLinkRelation" NOT NULL DEFAULT 'ABOUT';

-- CreateIndex
CREATE INDEX "DocumentLink_relation_idx" ON "DocumentLink"("relation");
