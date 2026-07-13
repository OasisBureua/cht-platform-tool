-- Repair _prisma_migrations schema after DMS / incomplete Aurora copies.
-- Symptom on migrate deploy:
--   Error: Failing row contains (..., migration_name, ..., null)
-- Cause: applied_steps_count is NOT NULL with no DEFAULT, so Prisma's insert fails.
-- Safe to re-run.

ALTER TABLE "_prisma_migrations"
  ALTER COLUMN "applied_steps_count" SET DEFAULT 0;

UPDATE "_prisma_migrations"
SET "applied_steps_count" = 0
WHERE "applied_steps_count" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = '_prisma_migrations_migration_name_key'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE indexname = '_prisma_migrations_migration_name_key'
  ) THEN
    ALTER TABLE "_prisma_migrations"
      ADD CONSTRAINT "_prisma_migrations_migration_name_key" UNIQUE ("migration_name");
  END IF;
END $$;
