-- Per-recipient log of platform-sent emails (invites, approvals, reminders, etc.).
CREATE TYPE "OutboundEmailType" AS ENUM (
  'REGISTRATION_INVITE',
  'REGISTRATION_SUBMITTED',
  'REGISTRATION_APPROVED',
  'REGISTRATION_REJECTED',
  'REGISTRATION_REVOKED',
  'PRE_SESSION_REMINDER',
  'POST_EVENT_SURVEY',
  'MISSED_SESSION',
  'OPERATIONAL',
  'PUBLIC_REGISTRATION',
  'WEBINAR_ACCESS',
  'REPORT_READY',
  'OTHER'
);

CREATE TYPE "OutboundEmailStatus" AS ENUM (
  'SENT',
  'DELIVERED',
  'BOUNCED',
  'FAILED',
  'UNSUBSCRIBED'
);

CREATE TABLE "OutboundEmailLog" (
  "id" TEXT NOT NULL,
  "toEmail" TEXT NOT NULL,
  "toName" TEXT,
  "emailType" "OutboundEmailType" NOT NULL,
  "status" "OutboundEmailStatus" NOT NULL DEFAULT 'SENT',
  "programId" TEXT,
  "userId" TEXT,
  "registrationId" TEXT,
  "inviteId" TEXT,
  "sentByUserId" TEXT,
  "sesMessageId" TEXT,
  "subject" TEXT,
  "errorMessage" TEXT,
  "providerStatusAt" TIMESTAMP(3),
  "resentFromId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OutboundEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OutboundEmailLog_programId_createdAt_idx" ON "OutboundEmailLog"("programId", "createdAt");
CREATE INDEX "OutboundEmailLog_toEmail_idx" ON "OutboundEmailLog"("toEmail");
CREATE INDEX "OutboundEmailLog_status_idx" ON "OutboundEmailLog"("status");
CREATE INDEX "OutboundEmailLog_emailType_idx" ON "OutboundEmailLog"("emailType");
CREATE INDEX "OutboundEmailLog_sesMessageId_idx" ON "OutboundEmailLog"("sesMessageId");
