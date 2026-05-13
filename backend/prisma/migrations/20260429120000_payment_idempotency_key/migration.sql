-- Dedupe worker inserts: same key = one row (SQS retries, double enqueue).
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
