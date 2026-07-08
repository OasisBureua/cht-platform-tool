-- Generic submission ids: native surveys use UUIDs; legacy Jotform webhooks store Jotform ids in the same columns.
ALTER TABLE "SurveyResponse" RENAME COLUMN "jotformSubmissionId" TO "submissionId";
ALTER INDEX IF EXISTS "SurveyResponse_jotformSubmissionId_key" RENAME TO "SurveyResponse_submissionId_key";

ALTER TABLE "ProgramRegistration" RENAME COLUMN "intakeJotformSubmissionId" TO "intakeSubmissionId";
