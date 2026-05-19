-- AlterTable: add nullable reminder timestamp for idempotent 24h pre-session email
ALTER TABLE "ProgramRegistration" ADD COLUMN "reminder24hSentAt" TIMESTAMP(3);
