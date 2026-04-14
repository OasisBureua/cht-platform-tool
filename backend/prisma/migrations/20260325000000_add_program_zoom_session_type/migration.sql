-- CreateEnum
CREATE TYPE "ProgramZoomSessionType" AS ENUM ('WEBINAR', 'MEETING');

-- AlterTable
ALTER TABLE "Program" ADD COLUMN "zoomSessionType" "ProgramZoomSessionType" NOT NULL DEFAULT 'WEBINAR';
