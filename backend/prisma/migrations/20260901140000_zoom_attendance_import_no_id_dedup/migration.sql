-- Allow staged attendees without a Zoom participant id; dedupe no-id report imports by email + join time.

ALTER TABLE "ZoomAttendanceParticipant"
  ALTER COLUMN "zoomParticipantId" DROP NOT NULL;

-- Replace full unique with partial indexes so NULL zoom ids do not collide.
DROP INDEX IF EXISTS "ZoomAttendanceParticipant_sessionId_zoomParticipantId_joinTime_key";

CREATE UNIQUE INDEX "ZoomAttendanceParticipant_sessionId_zoomParticipantId_joinTime_key"
  ON "ZoomAttendanceParticipant"("sessionId", "zoomParticipantId", "joinTime")
  WHERE "zoomParticipantId" IS NOT NULL;

CREATE UNIQUE INDEX "ZoomAttendanceParticipant_sessionId_email_joinTime_no_zoom_id_key"
  ON "ZoomAttendanceParticipant"("sessionId", "participantEmail", "joinTime")
  WHERE "zoomParticipantId" IS NULL AND "participantEmail" IS NOT NULL;

-- REPORT_IMPORT rows without a Zoom participant id: dedupe on program + email + join time.
CREATE UNIQUE INDEX "WebinarParticipantEvent_report_import_email_joinTime_key"
  ON "WebinarParticipantEvent"("programId", "participantEmail", "event", "source", "joinTime")
  WHERE "zoomParticipantId" IS NULL
    AND "source" = 'REPORT_IMPORT'
    AND "participantEmail" IS NOT NULL;
