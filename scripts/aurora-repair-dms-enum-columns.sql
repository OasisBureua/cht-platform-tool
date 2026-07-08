-- Convert DMS varchar columns to native PostgreSQL ENUM types (Prisma expects enums).
-- Run AFTER aurora-repair-dms-enums.sql (enum types must exist first).
-- Safe to re-run: skips when column is already the target enum type.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'role'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";
    ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'HCP'::"UserRole";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'status'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "User" ALTER COLUMN "status" TYPE "UserStatus" USING "status"::"UserStatus";
    ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"UserStatus";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Session' AND column_name = 'role'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "Session" ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'type'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "Payment" ALTER COLUMN "type" TYPE "PaymentType" USING "type"::"PaymentType";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Payment' AND column_name = 'status'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "Payment" ALTER COLUMN "status" TYPE "PaymentStatus" USING "status"::"PaymentStatus";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Program' AND column_name = 'status'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "Program" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "Program" ALTER COLUMN "status" TYPE "ProgramStatus" USING "status"::"ProgramStatus";
    ALTER TABLE "Program" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"ProgramStatus";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Program' AND column_name = 'zoomSessionType'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "Program" ALTER COLUMN "zoomSessionType" DROP DEFAULT;
    ALTER TABLE "Program" ALTER COLUMN "zoomSessionType" TYPE "ProgramZoomSessionType" USING "zoomSessionType"::"ProgramZoomSessionType";
    ALTER TABLE "Program" ALTER COLUMN "zoomSessionType" SET DEFAULT 'WEBINAR'::"ProgramZoomSessionType";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ProgramFormLink' AND column_name = 'kind'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "ProgramFormLink" ALTER COLUMN "kind" TYPE "ProgramFormLinkKind" USING "kind"::"ProgramFormLinkKind";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ProgramRegistration' AND column_name = 'status'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "ProgramRegistration" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "ProgramRegistration" ALTER COLUMN "status" TYPE "ProgramRegistrationStatus" USING "status"::"ProgramRegistrationStatus";
    ALTER TABLE "ProgramRegistration" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ProgramRegistrationStatus";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ProgramRegistration' AND column_name = 'postEventAttendanceStatus'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "ProgramRegistration" ALTER COLUMN "postEventAttendanceStatus" DROP DEFAULT;
    ALTER TABLE "ProgramRegistration" ALTER COLUMN "postEventAttendanceStatus" TYPE "PostEventAttendanceStatus" USING "postEventAttendanceStatus"::"PostEventAttendanceStatus";
    ALTER TABLE "ProgramRegistration" ALTER COLUMN "postEventAttendanceStatus" SET DEFAULT 'NOT_REQUIRED'::"PostEventAttendanceStatus";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'FormJotformProgress' AND column_name = 'scope'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "FormJotformProgress" ALTER COLUMN "scope" TYPE "FormJotformScope" USING "scope"::"FormJotformScope";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Survey' AND column_name = 'type'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "Survey" ALTER COLUMN "type" TYPE "SurveyType" USING "type"::"SurveyType";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Video' AND column_name = 'platform'
      AND udt_name = 'varchar'
  ) THEN
    ALTER TABLE "Video" ALTER COLUMN "platform" TYPE "VideoPlatform" USING "platform"::"VideoPlatform";
  END IF;
END $$;
