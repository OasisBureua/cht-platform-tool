-- Post-event completion is tracked via SurveyResponse (and postEventSurveyAcknowledgedAt).
ALTER TABLE "ProgramRegistration" DROP COLUMN IF EXISTS "postEventJotformSubmissionId";
