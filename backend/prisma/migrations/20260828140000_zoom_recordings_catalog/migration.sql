-- Zoom recordings catalog: sessions, files, sync jobs; migrate ProgramZoomRecording data.

CREATE TYPE "ZoomRecordingPullStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED');
CREATE TYPE "ZoomSyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "chmProgramId" TEXT;
CREATE INDEX IF NOT EXISTS "Program_chmProgramId_idx" ON "Program"("chmProgramId");

CREATE TABLE "ZoomRecordingSession" (
    "id" TEXT NOT NULL,
    "zoomMeetingId" TEXT NOT NULL,
    "zoomUuid" TEXT,
    "topic" TEXT,
    "hostEmail" TEXT,
    "sessionType" "ProgramZoomSessionType" NOT NULL DEFAULT 'WEBINAR',
    "startTime" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "totalSizeBytes" INTEGER,
    "programId" TEXT,
    "chmProgramId" TEXT,
    "firstSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoomRecordingSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ZoomRecordingSession_zoomMeetingId_key" ON "ZoomRecordingSession"("zoomMeetingId");
CREATE INDEX "ZoomRecordingSession_programId_idx" ON "ZoomRecordingSession"("programId");
CREATE INDEX "ZoomRecordingSession_startTime_idx" ON "ZoomRecordingSession"("startTime");
CREATE INDEX "ZoomRecordingSession_sessionType_idx" ON "ZoomRecordingSession"("sessionType");
CREATE INDEX "ZoomRecordingSession_chmProgramId_idx" ON "ZoomRecordingSession"("chmProgramId");

CREATE TABLE "ZoomRecordingFile" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "programId" TEXT,
    "zoomMeetingId" TEXT NOT NULL,
    "zoomRecordingFileId" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "recordingType" TEXT,
    "fileExtension" TEXT,
    "fileSizeBytes" INTEGER,
    "s3Bucket" TEXT,
    "s3Key" TEXT,
    "chmAssetFilename" TEXT,
    "pullStatus" "ZoomRecordingPullStatus" NOT NULL DEFAULT 'PENDING',
    "pullError" TEXT,
    "recordingStart" TIMESTAMP(3),
    "recordingEnd" TIMESTAMP(3),
    "topic" TEXT,
    "pulledAt" TIMESTAMP(3),
    "pulledByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoomRecordingFile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ZoomRecordingFile_zoomMeetingId_zoomRecordingFileId_key"
  ON "ZoomRecordingFile"("zoomMeetingId", "zoomRecordingFileId");
CREATE INDEX "ZoomRecordingFile_sessionId_idx" ON "ZoomRecordingFile"("sessionId");
CREATE INDEX "ZoomRecordingFile_programId_idx" ON "ZoomRecordingFile"("programId");
CREATE INDEX "ZoomRecordingFile_pullStatus_idx" ON "ZoomRecordingFile"("pullStatus");

CREATE TABLE "ZoomSyncJob" (
    "id" TEXT NOT NULL,
    "status" "ZoomSyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "monthsBack" INTEGER NOT NULL,
    "sessionTypeFilter" "ProgramZoomSessionType",
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "startedByUserId" TEXT,
    "progressJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZoomSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ZoomSyncJob_status_idx" ON "ZoomSyncJob"("status");
CREATE INDEX "ZoomSyncJob_createdAt_idx" ON "ZoomSyncJob"("createdAt");

ALTER TABLE "ZoomRecordingSession"
  ADD CONSTRAINT "ZoomRecordingSession_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ZoomRecordingFile"
  ADD CONSTRAINT "ZoomRecordingFile_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "ZoomRecordingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ZoomRecordingFile"
  ADD CONSTRAINT "ZoomRecordingFile_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill sessions from existing ProgramZoomRecording rows (if table exists).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ProgramZoomRecording'
  ) THEN
    INSERT INTO "ZoomRecordingSession" (
      "id",
      "zoomMeetingId",
      "topic",
      "sessionType",
      "programId",
      "startTime",
      "firstSyncedAt",
      "lastSyncedAt",
      "createdAt",
      "updatedAt"
    )
    SELECT
      gen_random_uuid()::text,
      agg."zoomMeetingId",
      agg."topic",
      agg."sessionType",
      agg."programId",
      agg."startTime",
      agg."firstSyncedAt",
      agg."lastSyncedAt",
      NOW(),
      NOW()
    FROM (
      SELECT
        pzr."zoomMeetingId",
        (array_agg(pzr."topic" ORDER BY pzr."pulledAt" DESC NULLS LAST))[1] AS "topic",
        COALESCE(
          (array_agg(p."zoomSessionType" ORDER BY pzr."pulledAt" DESC NULLS LAST))[1],
          'WEBINAR'::"ProgramZoomSessionType"
        ) AS "sessionType",
        (array_agg(pzr."programId" ORDER BY pzr."pulledAt" DESC NULLS LAST))[1] AS "programId",
        MIN(pzr."recordingStart") AS "startTime",
        MIN(pzr."pulledAt") AS "firstSyncedAt",
        MAX(pzr."pulledAt") AS "lastSyncedAt"
      FROM "ProgramZoomRecording" pzr
      JOIN "Program" p ON p."id" = pzr."programId"
      GROUP BY pzr."zoomMeetingId"
    ) agg
    ON CONFLICT ("zoomMeetingId") DO NOTHING;

    INSERT INTO "ZoomRecordingFile" (
      "id",
      "sessionId",
      "programId",
      "zoomMeetingId",
      "zoomRecordingFileId",
      "fileType",
      "recordingType",
      "fileExtension",
      "fileSizeBytes",
      "s3Bucket",
      "s3Key",
      "pullStatus",
      "recordingStart",
      "recordingEnd",
      "topic",
      "pulledAt",
      "pulledByUserId",
      "createdAt",
      "updatedAt"
    )
    SELECT
      picked."id",
      s."id",
      picked."programId",
      picked."zoomMeetingId",
      picked."zoomRecordingFileId",
      picked."fileType",
      picked."recordingType",
      picked."fileExtension",
      picked."fileSizeBytes",
      picked."s3Bucket",
      picked."s3Key",
      'COMPLETED'::"ZoomRecordingPullStatus",
      picked."recordingStart",
      picked."recordingEnd",
      picked."topic",
      picked."pulledAt",
      picked."pulledByUserId",
      picked."createdAt",
      picked."updatedAt"
    FROM (
      SELECT DISTINCT ON (pzr."zoomMeetingId", pzr."zoomRecordingFileId")
        pzr.*
      FROM "ProgramZoomRecording" pzr
      ORDER BY
        pzr."zoomMeetingId",
        pzr."zoomRecordingFileId",
        pzr."pulledAt" DESC NULLS LAST
    ) picked
    JOIN "ZoomRecordingSession" s ON s."zoomMeetingId" = picked."zoomMeetingId";

    DROP TABLE "ProgramZoomRecording";
  END IF;
END $$;
