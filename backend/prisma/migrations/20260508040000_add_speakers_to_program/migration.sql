-- Add speakers array to Program for storing speaker/KOL names
ALTER TABLE "Program" ADD COLUMN "speakers" TEXT[] NOT NULL DEFAULT '{}';
