-- AlterTable: add institution and location fields to User
-- Note: "state" column already exists from initial schema (professional details)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "institution" TEXT,
  ADD COLUMN IF NOT EXISTS "city"        TEXT,
  ADD COLUMN IF NOT EXISTS "zipCode"     TEXT;
