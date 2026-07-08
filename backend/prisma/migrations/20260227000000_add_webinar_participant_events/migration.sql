-- CreateTable
CREATE TABLE "WebinarParticipantEvent" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "userId" TEXT,
    "event" TEXT NOT NULL,
    "participantId" INTEGER,
    "participantName" TEXT,
    "participantEmail" TEXT,
    "isHost" BOOLEAN NOT NULL DEFAULT false,
    "platform" TEXT,
    "recallRecordingId" TEXT,
    "recallBotId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB,

    CONSTRAINT "WebinarParticipantEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebinarParticipantEvent_programId_idx" ON "WebinarParticipantEvent"("programId");

-- CreateIndex
CREATE INDEX "WebinarParticipantEvent_userId_idx" ON "WebinarParticipantEvent"("userId");

-- CreateIndex
CREATE INDEX "WebinarParticipantEvent_occurredAt_idx" ON "WebinarParticipantEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "WebinarParticipantEvent_event_idx" ON "WebinarParticipantEvent"("event");

-- AddForeignKey
ALTER TABLE "WebinarParticipantEvent" ADD CONSTRAINT "WebinarParticipantEvent_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
