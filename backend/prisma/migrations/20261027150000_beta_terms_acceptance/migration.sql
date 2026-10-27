-- Beta Participant Terms Agreement acceptance (beta period).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "betaTermsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "betaTermsVersion" TEXT;

CREATE INDEX IF NOT EXISTS "User_betaTermsAcceptedAt_idx" ON "User"("betaTermsAcceptedAt");

CREATE TABLE IF NOT EXISTS "BetaTermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "BetaTermsAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BetaTermsAcceptance_userId_idx" ON "BetaTermsAcceptance"("userId");
CREATE INDEX IF NOT EXISTS "BetaTermsAcceptance_acceptedAt_idx" ON "BetaTermsAcceptance"("acceptedAt");
CREATE INDEX IF NOT EXISTS "BetaTermsAcceptance_termsVersion_idx" ON "BetaTermsAcceptance"("termsVersion");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BetaTermsAcceptance_userId_fkey'
  ) THEN
    ALTER TABLE "BetaTermsAcceptance"
      ADD CONSTRAINT "BetaTermsAcceptance_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
