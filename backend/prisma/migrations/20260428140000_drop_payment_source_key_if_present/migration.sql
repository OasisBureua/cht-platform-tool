-- Revert optional idempotency column if a prior migration added it locally
DROP INDEX IF EXISTS "Payment_sourceKey_idx";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "sourceKey";
