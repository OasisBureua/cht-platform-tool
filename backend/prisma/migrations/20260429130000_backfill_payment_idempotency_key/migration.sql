-- One stable unique key per row so UNIQUE("idempotencyKey") is satisfied and worker ON CONFLICT stays meaningful.
-- New queue payouts use semantic keys (honorarium:..., survey_bonus:...); legacy rows use legacy_row:<payment id>.
UPDATE "Payment" SET "idempotencyKey" = 'legacy_row:' || "id" WHERE "idempotencyKey" IS NULL;
