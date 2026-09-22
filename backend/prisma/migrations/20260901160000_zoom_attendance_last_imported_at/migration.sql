-- Track when attendee import last ran for a catalog session (even if 0 participants or S3 export failed).
ALTER TABLE "ZoomRecordingSession"
ADD COLUMN "attendanceLastImportedAt" TIMESTAMP(3);
