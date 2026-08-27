-- Stripe Connect Express columns (Bill columns retained for historical audit)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeAccountId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeAccountStatus" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripePayoutsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeOnboardingCompleteAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_stripeAccountId_idx" ON "User"("stripeAccountId");

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "stripeTransferId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "stripePayoutId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_stripeTransferId_key" ON "Payment"("stripeTransferId");
