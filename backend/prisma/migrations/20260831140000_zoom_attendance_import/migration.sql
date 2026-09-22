-- Zoom attendance import: extend participant events + staging + import jobs

CREATE TYPE "WebinarParticipantEventSource" AS ENUM ('WEBHOOK', 'MEETING_SDK', 'REPORT_IMPORT');

ALTER TABLE "WebinarParticipantEvent"
  ADD COLUMN IF NOT EXISTS "source" "WebinarParticipantEventSource" NOT NULL DEFAULT 'WEBHOOK',
  ADD COLUMN IF NOT EXISTS "joinTime" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "leaveTime" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "durationSeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "importJobId" TEXT;

CREATE INDEX IF NOT EXISTS "WebinarParticipantEvent_source_idx"
  ON "WebinarParticipantEvent"("source");

CREATE UNIQUE INDEX IF NOT EXISTS "WebinarParticipantEvent_programId_zoomParticipantId_event_source_joinTime_key"
  ON "WebinarParticipantEvent"("programId", "zoomParticipantId", "event", "source", "joinTime");

CREATE TABLE IF NOT EXISTS "ZoomAttendanceImportJob" (
    "id" TEXT NOT NULL,
    "status" "ZoomSyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "monthsBack" INTEGER NOT NULL,
    "sessionTypeFilter" "ProgramZoomSessionType",
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "runAutoVerify" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "startedByUserId" TEXT,
    "progressJson" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ZoomAttendanceImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ZoomAttendanceImportJob_status_idx"
  ON "ZoomAttendanceImportJob"("status");
CREATE INDEX IF NOT EXISTS "ZoomAttendanceImportJob_createdAt_idx"
  ON "ZoomAttendanceImportJob"("createdAt");

CREATE TABLE IF NOT EXISTS "ZoomAttendanceParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "zoomMeetingId" TEXT NOT NULL,
    "zoomParticipantId" TEXT NOT NULL,
    "participantName" TEXT,
    "participantEmail" TEXT,
    "joinTime" TIMESTAMP(3) NOT NULL,
    "leaveTime" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "importJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ZoomAttendanceParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ZoomAttendanceParticipant_sessionId_zoomParticipantId_joinTime_key"
  ON "ZoomAttendanceParticipant"("sessionId", "zoomParticipantId", "joinTime");

CREATE INDEX IF NOT EXISTS "ZoomAttendanceParticipant_sessionId_idx"
  ON "ZoomAttendanceParticipant"("sessionId");
CREATE INDEX IF NOT EXISTS "ZoomAttendanceParticipant_zoomMeetingId_idx"
  ON "ZoomAttendanceParticipant"("zoomMeetingId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ZoomAttendanceParticipant_sessionId_fkey'
  ) THEN
    ALTER TABLE "ZoomAttendanceParticipant"
      ADD CONSTRAINT "ZoomAttendanceParticipant_sessionId_fkey"
      FOREIGN KEY ("sessionId") REFERENCES "ZoomRecordingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
