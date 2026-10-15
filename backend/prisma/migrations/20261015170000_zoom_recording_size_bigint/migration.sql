-- Zoom recordings over 2 GB (e.g. 2,422,755,454 bytes) overflow INT4.

-- AlterTable
ALTER TABLE "ZoomRecordingSession" ALTER COLUMN "totalSizeBytes" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "ZoomRecordingFile" ALTER COLUMN "fileSizeBytes" SET DATA TYPE BIGINT;
