-- Platform/DMS drift: Payment.idempotencyKey unique index and NOT NULL defaults can be missing
-- even when _prisma_migrations says migrations applied. Worker uses ON CONFLICT ("idempotencyKey").

UPDATE "Payment" SET "idempotencyKey" = 'legacy_row:' || "id" WHERE "idempotencyKey" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

ALTER TABLE "Payment" ALTER COLUMN "w9Collected" SET DEFAULT false;
ALTER TABLE "Payment" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
