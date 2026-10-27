-- SCRUM-292: per-program honorarium aging window.
ALTER TABLE "Program"
  ADD COLUMN "honorariumWindowDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "honorariumAtRiskDays" INTEGER NOT NULL DEFAULT 21;
