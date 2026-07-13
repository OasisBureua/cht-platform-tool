-- Repair unique indexes / constraints missing after DMS Aurora copies.
-- Symptom:
--   Prisma upsert fails with Postgres 42P10:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Cause: DMS copied tables but dropped unique indexes (e.g. ProgramRegistration userId+programId).
-- Safe to re-run.

CREATE UNIQUE INDEX IF NOT EXISTS "ProgramRegistration_userId_programId_key"
  ON "ProgramRegistration"("userId", "programId");

CREATE INDEX IF NOT EXISTS "ProgramRegistration_programId_idx"
  ON "ProgramRegistration"("programId");

CREATE INDEX IF NOT EXISTS "ProgramRegistration_status_idx"
  ON "ProgramRegistration"("status");

CREATE INDEX IF NOT EXISTS "ProgramRegistration_postEventAttendanceStatus_idx"
  ON "ProgramRegistration"("postEventAttendanceStatus");
