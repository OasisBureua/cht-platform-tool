-- SCRUM-292: new vs reused payout details, snapshotted at honorarium request.
CREATE TYPE "PayoutDetailsOrigin" AS ENUM ('NEW', 'REUSED');

ALTER TABLE "ProgramRegistration"
  ADD COLUMN "payoutDetailsOrigin" "PayoutDetailsOrigin";
