-- Add native webinar intake survey type (Phase 1 Jotform decoupling).
ALTER TYPE "SurveyType" ADD VALUE IF NOT EXISTS 'INTAKE';
