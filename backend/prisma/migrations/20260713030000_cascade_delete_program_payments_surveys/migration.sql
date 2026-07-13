-- When a Program is deleted, also delete its Surveys (and their responses via Survey cascade)
-- and Payments. Survey was already ON DELETE CASCADE in the initial schema; ensure the FK
-- exists (DMS / partial restores may have dropped it). Payments previously used SET NULL.

-- Survey: ensure CASCADE FK exists
ALTER TABLE "Survey" DROP CONSTRAINT IF EXISTS "Survey_programId_fkey";
ALTER TABLE "Survey"
  ADD CONSTRAINT "Survey_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Payment: switch SET NULL → CASCADE
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_programId_fkey";
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
