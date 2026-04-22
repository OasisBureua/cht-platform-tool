-- Remove Calendly; webinars do not use admin approval before enrollment
ALTER TABLE "Program" DROP COLUMN IF EXISTS "calendlySchedulingUrl";

UPDATE "Program" SET "registrationRequiresApproval" = false WHERE "zoomSessionType" = 'WEBINAR';
