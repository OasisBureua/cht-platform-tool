-- SCRUM-126: mark admin-customized surveys so template ensure operations remain non-destructive.
ALTER TABLE "Survey"
  ADD COLUMN IF NOT EXISTS "isCustomized" BOOLEAN NOT NULL DEFAULT false;
