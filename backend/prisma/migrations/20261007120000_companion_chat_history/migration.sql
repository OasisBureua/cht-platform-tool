CREATE TABLE IF NOT EXISTS "CompanionConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanionConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanionMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "finishReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompanionMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompanionConversation_userId_updatedAt_idx" ON "CompanionConversation"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "CompanionMessage_conversationId_createdAt_idx" ON "CompanionMessage"("conversationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "CompanionConversation" ADD CONSTRAINT "CompanionConversation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompanionMessage" ADD CONSTRAINT "CompanionMessage_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "CompanionConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
