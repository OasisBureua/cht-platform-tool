-- Replace redundant Session token index (unique constraint already indexes token)
DROP INDEX IF EXISTS "Session_token_idx";

-- Session lookups and cleanup by user
CREATE INDEX IF NOT EXISTS "Session_userId_idx" ON "Session"("userId");

-- Dashboard earnings: filter by user, status, paidAt range
CREATE INDEX IF NOT EXISTS "Payment_userId_status_paidAt_idx" ON "Payment"("userId", "status", "paidAt");

-- Payment history ordered by createdAt
CREATE INDEX IF NOT EXISTS "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- Dashboard stats: enrollments by user and completion
CREATE INDEX IF NOT EXISTS "ProgramEnrollment_userId_completed_idx" ON "ProgramEnrollment"("userId", "completed");

-- Published program listings
CREATE INDEX IF NOT EXISTS "Program_status_startDate_idx" ON "Program"("status", "startDate");

-- Peer benchmark earnings comparison
CREATE INDEX IF NOT EXISTS "User_totalEarnings_idx" ON "User"("totalEarnings");
