-- Post-production: transcripts written from recording audio (AWS Transcribe), editable.
CREATE TYPE "PostProductionTranscriptStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

CREATE TABLE "PostProductionTranscript" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "PostProductionTranscriptStatus" NOT NULL DEFAULT 'QUEUED',
  "jobName" TEXT,
  "mediaS3Uri" TEXT,
  "outputS3Key" TEXT,
  "error" TEXT,
  "cues" JSONB,
  "edited" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PostProductionTranscript_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostProductionTranscript_jobName_key" ON "PostProductionTranscript"("jobName");
CREATE INDEX "PostProductionTranscript_sourceKey_createdAt_idx" ON "PostProductionTranscript"("sourceKey", "createdAt");
