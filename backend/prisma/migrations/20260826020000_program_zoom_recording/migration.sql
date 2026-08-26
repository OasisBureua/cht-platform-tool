-- ProgramZoomRecording: Zoom cloud recording files stored in private S3
CREATE TABLE IF NOT EXISTS "ProgramZoomRecording" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "zoomMeetingId" TEXT NOT NULL,
    "zoomRecordingFileId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "recordingType" TEXT,
    "fileExtension" TEXT,
    "fileSizeBytes" INTEGER,
    "s3Bucket" TEXT NOT NULL,
    "s3Key" TEXT NOT NULL,
    "recordingStart" TIMESTAMP(3),
    "recordingEnd" TIMESTAMP(3),
    "topic" TEXT,
    "pulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pulledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProgramZoomRecording_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProgramZoomRecording_programId_zoomRecordingFileId_key"
  ON "ProgramZoomRecording"("programId", "zoomRecordingFileId");

CREATE INDEX IF NOT EXISTS "ProgramZoomRecording_programId_idx"
  ON "ProgramZoomRecording"("programId");

CREATE INDEX IF NOT EXISTS "ProgramZoomRecording_zoomMeetingId_idx"
  ON "ProgramZoomRecording"("zoomMeetingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProgramZoomRecording_programId_fkey'
  ) THEN
    ALTER TABLE "ProgramZoomRecording"
      ADD CONSTRAINT "ProgramZoomRecording_programId_fkey"
      FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
