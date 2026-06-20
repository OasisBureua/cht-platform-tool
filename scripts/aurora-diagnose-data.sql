-- Quick Aurora data/schema diagnostics after DMS cutover.
SELECT 'users_total' AS metric, COUNT(*)::text AS value FROM "User"
UNION ALL
SELECT 'users_hcp_active', COUNT(*)::text FROM "User" WHERE role::text = 'HCP' AND status::text = 'ACTIVE'
UNION ALL
SELECT 'payments_paid', COUNT(*)::text FROM "Payment" WHERE status::text = 'PAID'
UNION ALL
SELECT 'payments_total', COUNT(*)::text FROM "Payment"
UNION ALL
SELECT 'payments_paid_cents', COALESCE(SUM(amount)::text, '0') FROM "Payment" WHERE status::text = 'PAID';

SELECT table_name, column_name, udt_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('User', 'Payment', 'Session')
  AND column_name IN ('role', 'status')
ORDER BY table_name, column_name;
