-- AlterTable
ALTER TABLE "Program" ADD COLUMN     "publicRegistrationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SurveyResponse" ADD COLUMN     "publicRegistrationId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "PublicRegistration" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "emailSentAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PublicRegistration_token_key" ON "PublicRegistration"("token");

-- CreateIndex
CREATE INDEX "PublicRegistration_programId_idx" ON "PublicRegistration"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "PublicRegistration_programId_email_key" ON "PublicRegistration"("programId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyResponse_publicRegistrationId_key" ON "SurveyResponse"("publicRegistrationId");

-- AddForeignKey
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_publicRegistrationId_fkey" FOREIGN KEY ("publicRegistrationId") REFERENCES "PublicRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicRegistration" ADD CONSTRAINT "PublicRegistration_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Every response belongs to a user or to a public registration.
ALTER TABLE "SurveyResponse" ADD CONSTRAINT "SurveyResponse_owner_check" CHECK ("userId" IS NOT NULL OR "publicRegistrationId" IS NOT NULL);
