-- AlterTable
ALTER TABLE "AdminAuditLog" ADD COLUMN IF NOT EXISTS "actorRole" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminAuditLog_actorRole_idx" ON "AdminAuditLog"("actorRole");
