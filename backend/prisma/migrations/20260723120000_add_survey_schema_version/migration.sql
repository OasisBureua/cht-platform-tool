-- Formal schema revision for native surveys and stamped response snapshots.
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "schemaVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SurveyResponse" ADD COLUMN IF NOT EXISTS "schemaVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "SurveyResponse_surveyId_schemaVersion_idx"
  ON "SurveyResponse"("surveyId", "schemaVersion");
