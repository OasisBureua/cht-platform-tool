-- Per-event customizable participant emails (subject/greeting/body/sign-off).
CREATE TYPE "ProgramEmailKind" AS ENUM (
  'REGISTRATION_RECEIVED',
  'REGISTRATION_APPROVED',
  'SESSION_REMINDER',
  'POST_WEBINAR_SURVEY',
  'MISSED_SESSION',
  'PAYMENT_FOLLOW_UP'
);

CREATE TABLE "ProgramEmailOverride" (
  "id" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "emailKind" "ProgramEmailKind" NOT NULL,
  "subject" TEXT NOT NULL,
  "greeting" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "signOff" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProgramEmailOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProgramEmailOverride_programId_emailKind_key" ON "ProgramEmailOverride"("programId", "emailKind");
CREATE INDEX "ProgramEmailOverride_programId_idx" ON "ProgramEmailOverride"("programId");

ALTER TABLE "ProgramEmailOverride"
  ADD CONSTRAINT "ProgramEmailOverride_programId_fkey"
  FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProgramEmailOverrideVersion" (
  "id" TEXT NOT NULL,
  "overrideId" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "emailKind" "ProgramEmailKind" NOT NULL,
  "subject" TEXT NOT NULL,
  "greeting" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "signOff" TEXT NOT NULL,
  "editedByUserId" TEXT,
  "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgramEmailOverrideVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProgramEmailOverrideVersion_overrideId_editedAt_idx" ON "ProgramEmailOverrideVersion"("overrideId", "editedAt");
CREATE INDEX "ProgramEmailOverrideVersion_programId_emailKind_idx" ON "ProgramEmailOverrideVersion"("programId", "emailKind");

ALTER TABLE "ProgramEmailOverrideVersion"
  ADD CONSTRAINT "ProgramEmailOverrideVersion_overrideId_fkey"
  FOREIGN KEY ("overrideId") REFERENCES "ProgramEmailOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TYPE "OutboundEmailType" ADD VALUE IF NOT EXISTS 'PAYMENT_FOLLOW_UP';
