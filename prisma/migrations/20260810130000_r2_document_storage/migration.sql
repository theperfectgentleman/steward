-- AlterEnum
ALTER TYPE "DeliverableKind" ADD VALUE 'FILE';

-- AlterTable
ALTER TABLE "LibraryDocument" ADD COLUMN "storageKey" TEXT;

-- AlterTable
ALTER TABLE "EventDeliverable" ADD COLUMN "storageKey" TEXT;
ALTER TABLE "EventDeliverable" ADD COLUMN "fileName" TEXT;
ALTER TABLE "EventDeliverable" ADD COLUMN "mimeType" TEXT;
