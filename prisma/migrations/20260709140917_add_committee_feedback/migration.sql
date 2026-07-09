-- CreateTable
CREATE TABLE "CommitteeFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommitteeFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommitteeFeedback_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CommitteeFeedback_userId_committeeId_createdAt_idx" ON "CommitteeFeedback"("userId", "committeeId", "createdAt");

-- CreateIndex
CREATE INDEX "CommitteeFeedback_committeeId_status_createdAt_idx" ON "CommitteeFeedback"("committeeId", "status", "createdAt");
