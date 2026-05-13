-- CreateEnum
CREATE TYPE "PostEventAttendanceStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_VERIFICATION', 'VERIFIED', 'DENIED');

-- AlterTable
ALTER TABLE "ProgramRegistration" ADD COLUMN "postEventAttendanceStatus" "PostEventAttendanceStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "ProgramRegistration" ADD COLUMN "postEventAttendanceReviewedAt" TIMESTAMP(3);
ALTER TABLE "ProgramRegistration" ADD COLUMN "postEventAttendanceReviewedByUserId" TEXT;
ALTER TABLE "ProgramRegistration" ADD COLUMN "postEventSurveyAcknowledgedAt" TIMESTAMP(3);
ALTER TABLE "ProgramRegistration" ADD COLUMN "honorariumRequestedAt" TIMESTAMP(3);

CREATE INDEX "ProgramRegistration_postEventAttendanceStatus_idx" ON "ProgramRegistration"("postEventAttendanceStatus");
