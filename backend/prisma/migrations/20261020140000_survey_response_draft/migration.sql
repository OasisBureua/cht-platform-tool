-- Draft survey responses: answers saved before final complete + honorarium request.
ALTER TABLE "SurveyResponse" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;
