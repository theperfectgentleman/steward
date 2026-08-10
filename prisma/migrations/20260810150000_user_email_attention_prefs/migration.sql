-- User email notification preferences for attention digests

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailAttentionEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastAttentionEmailAt" TIMESTAMP(3);
