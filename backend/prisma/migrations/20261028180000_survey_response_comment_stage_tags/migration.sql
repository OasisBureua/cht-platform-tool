-- Admin stage tags for free-text survey comments (HCP Beta Testing Survey Q16).
ALTER TABLE "SurveyResponse" ADD COLUMN IF NOT EXISTS "commentStageTags" TEXT[] DEFAULT ARRAY[]::TEXT[];
