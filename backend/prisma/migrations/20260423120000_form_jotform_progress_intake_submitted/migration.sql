-- CreateEnum
CREATE TYPE "FormJotformScope" AS ENUM ('SURVEY', 'INTAKE');

-- AlterTable
ALTER TABLE "ProgramRegistration" ADD COLUMN "intakeJotformSubmittedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FormJotformProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" "FormJotformScope" NOT NULL,
    "refId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormJotformProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormJotformProgress_userId_scope_refId_key" ON "FormJotformProgress"("userId", "scope", "refId");

-- CreateIndex
CREATE INDEX "FormJotformProgress_expiresAt_idx" ON "FormJotformProgress"("expiresAt");

-- AddForeignKey
ALTER TABLE "FormJotformProgress" ADD CONSTRAINT "FormJotformProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
