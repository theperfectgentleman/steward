-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('UPLOAD', 'CREATED');

-- CreateEnum
CREATE TYPE "LibraryDocumentTag" AS ENUM ('REPORT', 'MINUTES', 'POLICY', 'BRIEF', 'FORM', 'OTHER');

-- CreateTable
CREATE TABLE "LibraryDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tag" "LibraryDocumentTag" NOT NULL DEFAULT 'OTHER',
    "source" "DocumentSource" NOT NULL DEFAULT 'CREATED',
    "body" TEXT,
    "fileName" TEXT,
    "fileUrl" TEXT,
    "mimeType" TEXT,
    "committeeId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryDocument_committeeId_tag_createdAt_idx" ON "LibraryDocument"("committeeId", "tag", "createdAt");

-- CreateIndex
CREATE INDEX "LibraryDocument_tag_createdAt_idx" ON "LibraryDocument"("tag", "createdAt");

-- AddForeignKey
ALTER TABLE "LibraryDocument" ADD CONSTRAINT "LibraryDocument_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryDocument" ADD CONSTRAINT "LibraryDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
