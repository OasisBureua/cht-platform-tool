-- Explicit ACH vs Check payment preference + check delivery monitoring

CREATE TYPE "PreferredPaymentMethod" AS ENUM ('ACH', 'CHECK');
CREATE TYPE "PaymentDeliveryMethod" AS ENUM ('ACH', 'CHECK');

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "preferredPaymentMethod" "PreferredPaymentMethod",
  ADD COLUMN IF NOT EXISTS "bankAccountLast4" TEXT;

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "deliveryMethod" "PaymentDeliveryMethod",
  ADD COLUMN IF NOT EXISTS "checkStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "checkMailedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "checkDeliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "checkTrackingInfo" TEXT;
