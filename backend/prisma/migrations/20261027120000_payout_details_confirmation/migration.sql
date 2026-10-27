-- Per-program confirmation that the learner approved Stripe payout details for this honorarium.
CREATE TYPE "PayoutDetailsEntryKind" AS ENUM ('REUSED', 'NEWLY_ENTERED');

ALTER TABLE "ProgramRegistration"
  ADD COLUMN "payoutDetailsConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "payoutDetailsEntryKind" "PayoutDetailsEntryKind";
