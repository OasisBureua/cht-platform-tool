-- CreateTable
CREATE TABLE "registration_invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "programIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT,

    CONSTRAINT "registration_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_invites_token_key" ON "registration_invites"("token");

-- CreateIndex
CREATE INDEX "registration_invites_token_idx" ON "registration_invites"("token");

-- CreateIndex
CREATE INDEX "registration_invites_email_idx" ON "registration_invites"("email");

-- CreateIndex
CREATE INDEX "registration_invites_expiresAt_idx" ON "registration_invites"("expiresAt");
