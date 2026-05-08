-- Add zoomPanelistLinks JSON column to Program for persisting Zoom panelist join URLs
ALTER TABLE "Program" ADD COLUMN "zoomPanelistLinks" JSONB;
