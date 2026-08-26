-- When Zoom sends meeting.ended / webinar.ended, we store actual end time for post-event survey gating.
ALTER TABLE "Program" ADD COLUMN "zoomSessionEndedAt" TIMESTAMP(3);
