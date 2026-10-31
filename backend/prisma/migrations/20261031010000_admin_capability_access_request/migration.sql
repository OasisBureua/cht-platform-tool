-- CreateEnum
CREATE TYPE "AdminCapabilityRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AdminCapabilityAccessRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "capabilities" TEXT[],
    "note" TEXT,
    "status" "AdminCapabilityRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "AdminCapabilityAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminCapabilityAccessRequest_status_createdAt_idx" ON "AdminCapabilityAccessRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AdminCapabilityAccessRequest_requesterId_status_idx" ON "AdminCapabilityAccessRequest"("requesterId", "status");

-- AddForeignKey
ALTER TABLE "AdminCapabilityAccessRequest" ADD CONSTRAINT "AdminCapabilityAccessRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCapabilityAccessRequest" ADD CONSTRAINT "AdminCapabilityAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
