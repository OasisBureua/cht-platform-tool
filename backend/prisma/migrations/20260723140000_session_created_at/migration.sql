-- Absolute session lifetime needs a create-time anchor.
-- Backfill approximates original login as idle expiry minus 30 minutes.
ALTER TABLE "Session" ADD COLUMN "createdAt" TIMESTAMP(3);

UPDATE "Session"
SET "createdAt" = "expiresAt" - INTERVAL '30 minutes'
WHERE "createdAt" IS NULL;

ALTER TABLE "Session" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "Session" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
