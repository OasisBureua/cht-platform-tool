-- Migration: drop_bill_com_columns
-- Removes Bill.com vendor columns from User and Bill.com payment columns from Payment.
-- Stripe Connect is now the sole payment rail.

-- Drop index on billVendorId before dropping the column
DROP INDEX IF EXISTS "User_billVendorId_idx";

-- Drop Bill.com columns from User
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "billVendorId",
  DROP COLUMN IF EXISTS "billVendorStatus";

-- Drop unique constraints on Bill.com payment columns before dropping them
ALTER TABLE "Payment"
  DROP CONSTRAINT IF EXISTS "Payment_billPaymentIntentId_key",
  DROP CONSTRAINT IF EXISTS "Payment_billPaymentId_key";

-- Drop Bill.com columns from Payment
ALTER TABLE "Payment"
  DROP COLUMN IF EXISTS "billPaymentIntentId",
  DROP COLUMN IF EXISTS "billPaymentId";
