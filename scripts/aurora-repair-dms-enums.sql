-- Repair PostgreSQL ENUM types missing after DMS migration to Aurora.
-- DMS copies _prisma_migrations (so "migrate deploy" is a no-op) but often
-- does not create custom ENUM types. Prisma session inserts then fail with:
--   type "public.UserRole" does not exist
--
-- Safe to re-run: each CREATE TYPE is wrapped in duplicate_object handler.

DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('HCP', 'KOL', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "VideoPlatform" AS ENUM ('VIMEO', 'YOUTUBE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "SurveyType" AS ENUM ('PRE_TEST', 'POST_TEST', 'FEEDBACK', 'INTAKE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "PaymentType" AS ENUM ('HONORARIUM', 'CME_COMPLETION', 'SURVEY_BONUS', 'REFERRAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ProgramZoomSessionType" AS ENUM ('WEBINAR', 'MEETING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "PostEventAttendanceStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_VERIFICATION', 'VERIFIED', 'DENIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "FormJotformScope" AS ENUM ('SURVEY', 'INTAKE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ProgramRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WAITLISTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ProgramFormLinkKind" AS ENUM ('INTAKE', 'PRE_EVENT', 'POST_EVENT', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
