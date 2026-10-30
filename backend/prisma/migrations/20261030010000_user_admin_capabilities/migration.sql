-- AlterTable
ALTER TABLE "User" ADD COLUMN "adminCapabilities" TEXT[] DEFAULT ARRAY[]::TEXT[];
