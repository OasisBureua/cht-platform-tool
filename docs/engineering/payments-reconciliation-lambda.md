# Payments reconciliation (Lambda)

Near-term Stripe model: **CHM bank → Stripe platform balance → HCP Connect transfer** (admin **Pay now**). Reconciliation is **read-only reporting** — it does not change Pay now.

## Goal

- **Monthly:** CSV for the prior calendar month for Andrew (finance).
- **Quarterly:** same pack + rollups (by campaign / `chmProgramId`, failure rate, avg days submission → paid).

Labels already stamped on transfers / available in DB:

- `Payment.stripeTransferId`, `paidAt`, `status`, `amount`
- Program `chmProgramId`, `sponsorName` (campaign label)
- Transfer metadata: `paymentId`, `chmProgramId`, `campaignLabel`, `userId`, `programId`

## Architecture

```text
                    ┌─────────────────────┐
  EventBridge       │  payments-recon     │
  schedule ────────►│  Lambda             │
  (1st of month /   │                     │
   quarterly)       └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Aurora/Postgres   Stripe API      S3 + SES
         Payment × User    Transfers       CSV + email
         × Program         (optional       to Andrew
                           cross-check)
```

### Why Lambda (not ECS cron)

- Runs monthly/quarterly — no need to keep a worker schedule hot.
- Isolated IAM: read DB + Stripe secret + write one S3 prefix + SES.
- Easy to invoke manually for a backfill (`aws lambda invoke` with `{ "period": "2026-08" }`).

### Components

| Piece | Role |
|--------|------|
| **EventBridge rule** | `cron(0 14 1 * ? *)` UTC ≈ morning on the 1st (monthly). Separate rule for quarter-end. |
| **Lambda** | Load payments in window; join program labels; optional Stripe list/retrieve by `stripeTransferId`; write CSV; email. |
| **Secrets** | Reuse app secrets for Stripe + DB (or dedicated recon secret with read-only DB user). |
| **S3** | `s3://cht-{env}-reports/recon/payments/YYYY-MM/payments.csv` (+ `exceptions.csv`). |
| **SES** | Email Andrew (+ optional Seth) with S3 links or CSV attachment (prefer S3 link if large). |

### Lambda input

```json
{
  "mode": "monthly",
  "period": "2026-08",
  "dryRun": false
}
```

- `mode`: `monthly` \| `quarterly`
- `period`: `YYYY-MM` or `YYYY-Qn` (optional; default = previous period)
- `dryRun`: write nothing / email nothing; log row counts only

### Monthly CSV columns (minimum)

`paymentId`, `createdAt`, `paidAt`, `amountCents`, `status`, `type`, `userId`, `userEmail`, `programId`, `programTitle`, `chmProgramId`, `campaignLabel`, `stripeTransferId`, `failureReason`

### Exception report (same run)

- `PAID` with no `stripeTransferId`
- Stripe transfer exists for metadata `paymentId` but no DB row (if Stripe cross-check enabled)
- `FAILED` in period
- `PENDING` older than **14 calendar days** (ops SLA — not expiry)

### Quarterly extras

- Totals by `campaignLabel` / `chmProgramId`
- Count paid / failed / pending
- Avg calendar days from `createdAt` → `paidAt` for paid rows
- Optional: ops-supplied balance top-up total vs paid-out (manual input or Stripe Balance Transactions export)

## Security

- Lambda role: `rds-db:connect` or VPC + SG to Aurora; `s3:PutObject` on recon prefix only; `ses:SendEmail`; read Stripe secret.
- No Pay now / transfer create permissions.
- CSV may contain PII (email) — private bucket, short-lived signed URLs in email.

## Implementation sketch

1. Terraform: Lambda (Node 20 or Python), EventBridge rules, S3 prefix, IAM, VPC config if DB is private.
2. Query Postgres for `Payment` where `paidAt` or `createdAt` in window (define window rules with finance — recommend: **paidAt** for paid rows; include FAILED by `failedAt`; PENDING snapshot separately).
3. Join `Program` for `chmProgramId` / `sponsorName`.
4. Optional: for each `stripeTransferId`, `stripe.transfers.retrieve` and assert metadata match.
5. Upload CSV(s); SES notify.

## Ops checklist

- [ ] Confirm Google reCAPTCHA / Stripe are unrelated — recon never touches captcha.
- [ ] Agree email recipients and S3 bucket with Andrew.
- [ ] Manual invoke for last month before enabling schedule.
- [ ] Document “PENDING > 14 days” as SLA alert for ops, not auto-cancel.

## Out of scope (near term)

- Charging sponsors / payer-per-request
- Changing admin Pay now
- Auto-expiring payments (payments stay until paid/failed/cancelled or program deleted)
