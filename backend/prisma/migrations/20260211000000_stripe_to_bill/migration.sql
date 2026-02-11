-- AlterTable: Rename Stripe columns to Bill.com on User
ALTER TABLE "User" RENAME COLUMN "stripeAccountId" TO "billVendorId";
ALTER TABLE "User" RENAME COLUMN "stripeAccountStatus" TO "billVendorStatus";

-- AlterTable: Rename Stripe columns to Bill.com on Payment
ALTER TABLE "Payment" RENAME COLUMN "stripeTransferId" TO "billPaymentId";
ALTER TABLE "Payment" RENAME COLUMN "stripePaymentIntentId" TO "billPaymentIntentId";

-- Update unique indexes on Payment (Prisma expects new names)
DROP INDEX IF EXISTS "Payment_stripePaymentIntentId_key";
DROP INDEX IF EXISTS "Payment_stripeTransferId_key";
CREATE UNIQUE INDEX "Payment_billPaymentIntentId_key" ON "Payment"("billPaymentIntentId");
CREATE UNIQUE INDEX "Payment_billPaymentId_key" ON "Payment"("billPaymentId");

-- Update index on User
DROP INDEX IF EXISTS "User_stripeAccountId_idx";
CREATE INDEX "User_billVendorId_idx" ON "User"("billVendorId");
