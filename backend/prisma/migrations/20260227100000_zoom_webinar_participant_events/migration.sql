-- AlterTable: Update WebinarParticipantEvent for Zoom webhooks (replacing Recall.ai fields)
ALTER TABLE "WebinarParticipantEvent" DROP COLUMN IF EXISTS "participantId";
ALTER TABLE "WebinarParticipantEvent" DROP COLUMN IF EXISTS "platform";
ALTER TABLE "WebinarParticipantEvent" DROP COLUMN IF EXISTS "recallRecordingId";
ALTER TABLE "WebinarParticipantEvent" DROP COLUMN IF EXISTS "recallBotId";

ALTER TABLE "WebinarParticipantEvent" ADD COLUMN "zoomMeetingId" TEXT;
ALTER TABLE "WebinarParticipantEvent" ADD COLUMN "zoomParticipantId" TEXT;

CREATE INDEX "WebinarParticipantEvent_zoomMeetingId_idx" ON "WebinarParticipantEvent"("zoomMeetingId");
