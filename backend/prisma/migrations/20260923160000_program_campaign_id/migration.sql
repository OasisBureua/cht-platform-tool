-- Hub campaign link for Cross-Platform Reporting export (CPR-28).
-- Values are Hub campaigns.id strings (e.g. AZ-25-01_LIV001), not UUIDs.
ALTER TABLE "Program" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

CREATE INDEX IF NOT EXISTS "Program_campaignId_idx" ON "Program"("campaignId");
