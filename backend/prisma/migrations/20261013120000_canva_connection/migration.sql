-- Send to Canva: one Canva Connect authorization per admin.
CREATE TABLE IF NOT EXISTS "CanvaConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "pendingState" TEXT,
    "pendingVerifier" TEXT,
    "pendingExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CanvaConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CanvaConnection_userId_key" ON "CanvaConnection"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "CanvaConnection_pendingState_key" ON "CanvaConnection"("pendingState");

DO $$ BEGIN
  ALTER TABLE "CanvaConnection" ADD CONSTRAINT "CanvaConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
