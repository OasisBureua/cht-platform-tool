-- Attendee report export metadata on catalog sessions (S3 CSV under zoom-recordings/…)

ALTER TABLE "ZoomRecordingSession"
  ADD COLUMN IF NOT EXISTS "attendeeReportS3Bucket" TEXT,
  ADD COLUMN IF NOT EXISTS "attendeeReportS3Key" TEXT,
  ADD COLUMN IF NOT EXISTS "attendeeReportExportedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "attendeeReportParticipantCount" INTEGER;
