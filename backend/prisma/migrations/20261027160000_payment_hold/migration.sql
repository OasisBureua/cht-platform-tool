-- SCRUM-292: admin hold on a PENDING honorarium payout.
ALTER TABLE "Payment"
  ADD COLUMN "heldAt" TIMESTAMP(3),
  ADD COLUMN "heldByUserId" TEXT,
  ADD COLUMN "holdReason" TEXT;
