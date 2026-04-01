-- CreateEnum
CREATE TYPE "ProgramRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "ProgramFormLinkKind" AS ENUM ('INTAKE', 'PRE_EVENT', 'POST_EVENT', 'CUSTOM');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "jotformIntakeFormUrl" TEXT,
ADD COLUMN     "jotformPreEventUrl" TEXT,
ADD COLUMN     "hostDisplayName" TEXT,
ADD COLUMN     "calendlySchedulingUrl" TEXT,
ADD COLUMN     "registrationRequiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProgramRegistration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "status" "ProgramRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "intakeJotformSubmissionId" TEXT,
    "officeHoursSlotId" TEXT,
    "adminNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "calendarInviteSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeHoursSlot" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "maxAttendees" INTEGER NOT NULL DEFAULT 8,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeHoursSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramFormLink" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "kind" "ProgramFormLinkKind" NOT NULL,
    "label" TEXT NOT NULL,
    "jotformUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramFormLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgramRegistration_userId_programId_key" ON "ProgramRegistration"("userId", "programId");

-- CreateIndex
CREATE INDEX "ProgramRegistration_programId_idx" ON "ProgramRegistration"("programId");

-- CreateIndex
CREATE INDEX "ProgramRegistration_status_idx" ON "ProgramRegistration"("status");

-- CreateIndex
CREATE INDEX "OfficeHoursSlot_programId_idx" ON "OfficeHoursSlot"("programId");

-- CreateIndex
CREATE INDEX "ProgramFormLink_programId_idx" ON "ProgramFormLink"("programId");

-- AddForeignKey
ALTER TABLE "ProgramRegistration" ADD CONSTRAINT "ProgramRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRegistration" ADD CONSTRAINT "ProgramRegistration_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRegistration" ADD CONSTRAINT "ProgramRegistration_officeHoursSlotId_fkey" FOREIGN KEY ("officeHoursSlotId") REFERENCES "OfficeHoursSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeHoursSlot" ADD CONSTRAINT "OfficeHoursSlot_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramFormLink" ADD CONSTRAINT "ProgramFormLink_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
