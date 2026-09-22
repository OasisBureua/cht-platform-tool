# Bill.com → Stripe Migration

**Status:** Architecture / planning  
**Owner:** Platform (payments)  
**Related:** [integrations.md](./integrations.md), current `backend/src/modules/payments/`

Migrate HCP honorarium payouts from **Bill.com Connect v3** to **Stripe Connect**, with optional **Stripe Tax Forms** for W-9 / 1099. Keep CHT’s eligibility queue, admin Pay-now, and payment status machine; swap the settlement rail.

---

## 1. Why migrate

| Bill.com pain (today) | Stripe benefit |
| --------------------- | -------------- |
| Session/MFA login complexity for API | API keys + Connect; no Bill session TTL/MFA trust |
| Vendor + bank CRUD hand-rolled | Connect onboarding / external accounts |
| Check mailing is first-class | ACH/bank payouts (see §3 on checks) |
| Separate tax push to vendor | Stripe Tax Forms (W-9 / 1099) for eligible Connect platforms |

This repo already migrated **Stripe → Bill** once (`prisma/migrations/20260211000000_stripe_to_bill`). This plan is the reverse, with today’s ACH/check preference and Program Hub pay flows on top.

---

## 2. Current Bill architecture (baseline)

```text
HCP Settings → BillVendorSetupForm → POST /api/payments/:userId/connect-account
                 → BillService.createVendor / bank-account
                 → User.billVendorId, preferredPaymentMethod, bankAccountLast4
HCP W-9 → POST /api/payments/:userId/w9 → Bill vendor tax fields

Admin Pay now → PaymentsService.payNow
                 → syncVendorPaymentMethod (ACH vs delete bank = check)
                 → BillService.createPayment → Payment.billPaymentId, status PAID/FAILED

Webhooks → POST /api/webhooks/bill → payment.updated / failed → Payment status
```

### Key code

| Area | Path |
| ---- | ---- |
| Bill client | `backend/src/modules/payments/bill.service.ts` |
| Orchestration | `backend/src/modules/payments/payments.service.ts` |
| Webhooks | `bill-webhook.controller.ts` / `bill-webhook.service.ts` |
| HCP UI | `frontend/src/components/payments/BillVendorSetupForm.tsx`, Settings / Payments |
| Admin UI | `frontend/src/pages/admin/AdminPayments.tsx` |

### Data model (today)

**User:** `billVendorId`, `billVendorStatus`, `paymentEnabled`, `w9Submitted`, `preferredPaymentMethod` (`ACH` \| `CHECK`), `bankAccountLast4`, `totalEarnings`

**Payment:** `billPaymentId`, `billPaymentIntentId`, `deliveryMethod`, `checkStatus` / mail timestamps, `status` (`PENDING` → `PROCESSING` → `PAID` / `FAILED` / …), `idempotencyKey`

### Secrets (today)

`BILL_DEV_KEY`, `BILL_USERNAME`, `BILL_PASSWORD`, `BILL_ORG_ID`, `BILL_FUNDING_ACCOUNT_ID`, `BILL_SESSION_ID`, `BILL_WEBHOOK_SECRET`, MFA remember-me vars — Secrets Manager → ECS.

---

## 3. Product decisions (**LOCKED** — PAY-1 / SCRUM-232)

| Decision | Locked choice |
| -------- | ------------- |
| **Connect type** | **Express-style recipient** via **Accounts v2** (`POST /v2/core/accounts` + `recipient` + `stripe_transfers`). Embedded Account Session for onboarding. (Accounts v1 `type=express` create is blocked for new platforms on API `2026-08-26.dahlia` unless Dashboard `feat_accounts_v1_support` is enabled.) |
| **Payout rail** | Platform balance → **Transfer / Payout** to connected account (**ACH to bank only**) |
| **Paper checks** | **Dropped.** Stripe does not mail checks. No secondary check vendor in v1. HCPs who previously used CHECK must re-onboard with a bank account. Offline/manual check only if finance invents an exception SOP outside the app |
| **Tax** | **PAY-4:** Collect TIN/name/address via **Express embedded onboarding** requirements (`requirements.currently_due` / `past_due`). No Stripe Tax Forms product in Dashboard — finance owns 1099 (assumed NEC). `User.w9Submitted` is set **only** from Stripe `taxComplete` (legacy Bill W-9 does not satisfy eligibility on Stripe envs). `POST /w9` syncs status only; does not push TIN to Bill |
| **Cutover** | **No dual-run.** Build and test on **dev**, then deploy to **testapp**, test there, then go live. Stripe replaces Bill in that environment when promoted |
| **Re-onboard** | Existing `billVendorId` users **must re-onboard** to Connect when that environment switches (IDs do not port) |
| **Env secrets** | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` — when secret key is set, Bill happy path is disabled. **Dev:** set once in AWS Secrets Manager `cht-dev-app-secrets` (not via `deploy-dev.yml`); Terraform keeps existing `stripe_*` when TF vars are empty. **Platform/prod:** still passed as `TF_VAR_stripe_*` from GitHub Environment secrets in `deploy-prod.yml`. |
| **PAY-3 UX** | In-app embedded onboarding; copy uses **legal name / business entity** (not “payee”); brand marks use Stripe logo |

---

## 4. Target architecture

```text
HCP Settings → Stripe Connect Embedded onboarding (Account Session)
                 → User.stripeAccountId, payoutsEnabled, bankAccountLast4
                 → Express tax requirements → w9Submitted / stripe tax status

Admin Pay now → eligibility (attendance, survey, Stripe account ready)
                 → Stripe Transfer (or Payout) to connected account
                 → Payment.stripeTransferId / stripePayoutId, status PAID/FAILED

Webhooks → POST /api/webhooks/stripe
                 → account.updated, transfer.*, payout.*, capability updates
```

### Recommended interface (provider swap)

```ts
interface PayoutProvider {
  createPayee(user, method): Promise<{ externalId: string }>;
  updatePaymentMethod(externalId, method): Promise<void>;
  submitTaxInfo?(…): Promise<void>; // or Tax Forms hosted flow
  pay(payment, payeeExternalId): Promise<{ providerPaymentId: string }>;
  mapWebhook(event): PaymentStatusUpdate | null;
}
```

Implement `StripeService` and wire `PaymentsService` to Stripe. Remove Bill client usage when the environment is cut over—**no** long-lived `PAYMENT_PROVIDER=bill|stripe` dual path in production.

---

## 5. Stripe mapping

| Bill concept | Stripe concept |
| ------------ | -------------- |
| Vendor `vnd_*` | Connect account `acct_*` |
| Bank on vendor | External bank account / Connect payouts debit |
| No bank = check | **Not supported** — product change |
| `POST /payments` | Transfer to connected account (or Charge + transfer, depending on charge type) |
| Funding account `bac_*` | Platform Stripe balance / bank funding in Dashboard |
| Bill Elements session | Account Links / Connect embedded components |
| Vendor taxId | Tax Forms / Connect requirements |
| `payment.updated` webhook | `transfer.paid`, `payout.paid`, `payout.failed`, etc. |

Exact Transfer vs Destination charge pattern depends on whether funds sit on the platform first (typical for honoraria after admin approval).

---

## 6. Data model changes

| Action | Detail |
| ------ | ------ |
| Add | `User.stripeAccountId`, `stripeAccountStatus` / `payoutsEnabled`, optional `stripeOnboardingCompleteAt` |
| Keep | `preferredPaymentMethod` — likely **ACH-only** after cutover; deprecate `CHECK` in UI |
| Keep | `w9Submitted` — set from Tax Forms / requirements.currently_due empty |
| Rename or add | `Payment.stripeTransferId` / `stripePayoutId` (keep old Bill columns for historical rows) |
| Do not | Rewrite historical `billPaymentId` rows; leave for audit |

Migration sketch:

1. Add Stripe columns nullable; keep Bill columns for historical audit rows.  
2. On **dev**: ship Stripe-only payouts; test end-to-end.  
3. On **testapp**: deploy same Stripe-only code; run the same test plan.  
4. After sign-off: remove Bill secrets/code paths from that environment (and later from the repo).

---

## 7. Workstreams

### 7.1 Backend

- [ ] Add `stripe` SDK; config: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, Connect settings  
- [ ] `StripeService` (accounts, account links, transfers, webhook verify)  
- [ ] Point `PaymentsService` pay/onboard/W-9 flows at Stripe (replace Bill calls)  
- [ ] Add `POST /api/webhooks/stripe`; remove Bill webhook once env is on Stripe  
- [ ] Eligibility unchanged; “ready to pay” = Connect account + payouts enabled + tax complete  
- [ ] Delete Bill session/MFA/login client code after testapp sign-off

### 7.2 Frontend

- [ ] Replace `BillVendorSetupForm` / Bill branding with Connect onboarding  
- [ ] Settings Payment tab: status from Stripe account/capabilities  
- [ ] Admin Payments: same queue UX; copy ACH-only if checks dropped  
- [ ] Env: publishable key for any embedded Connect UI  

### 7.3 Infra / ops

- [ ] Secrets Manager + ECS env (add Stripe; later remove `BILL_*`)  
- [ ] Stripe Dashboard webhook → prod/dev `/api/webhooks/stripe`  
- [ ] Update [integrations.md](./integrations.md), IR vendor list, runbooks  

### 7.4 Compliance / finance

- [ ] Confirm Connect platform profile, payout schedule, BAA if needed  
- [ ] Confirm Tax Forms eligibility for your entity / Connect setup  
- [ ] Document check retirement or offline check SOP  

---

## 8. Cutover plan (env-sequential — **no dual-run**)

Do **not** run Bill and Stripe side-by-side for different users in the same environment. Validate fully in one env, then promote.

| Phase | Environment | Actions |
| ----- | ----------- | ------- |
| **0** | — | Product lock: Express vs Custom; checks; Tax Forms |
| **1** | **dev** | Implement Stripe Connect + Tax Forms + pay-now + webhooks. Point secrets/webhooks at Stripe **test** mode |
| **2** | **dev** | Test plan: onboard HCP → W-9/tax → admin Pay-now → webhook `PAID` / failure paths; Settings + Admin Payments UI |
| **3** | **testapp** | Deploy the same Stripe-only build. Stripe **live** (or test→live per finance). Re-onboard any testapp HCPs who only had Bill vendors |
| **4** | **testapp** | Repeat test plan with real-ish amounts / finance sign-off |
| **5** | **testapp** (then broader prod if separate) | Remove `BILL_*` secrets; drop Bill webhook; HCPs use Stripe only |

**Before testapp cutover:** settle or cancel open Bill `PENDING` / `PROCESSING` rows on that env, or accept they won’t settle via Bill after switch.

**Rollback:** Redeploy previous Bill build + restore Bill secrets for that env only (not a per-user provider flag). Prefer fixing forward on Stripe once Phase 2 passed on dev.

### Dev / testapp test checklist

- [ ] Connect onboarding completes; `stripeAccountId` stored  
- [ ] Tax / W-9 satisfied via Express requirements; `w9Submitted` true from Stripe `taxComplete` only  
- [ ] Admin Pay-now creates Stripe transfer/payout; row → `PAID` via webhook  
- [ ] Forced failure path → `FAILED` + reason  
- [ ] Retry from admin works  
- [ ] Historical Bill payment rows still display in admin (read-only)  
- [ ] Bill `POST /w9` vendor tax push unused when `STRIPE_SECRET_KEY` set  
- [ ] CHECK UX removed or documented offline if still needed 

---

## 9. What does *not* change

- Honorarium eligibility (attendance verified, survey ack, PENDING queue)  
- Admin list / retry / CSV patterns  
- `PaymentType` / `PaymentStatus` enums (map Stripe events into the same statuses)  
- Program Hub / registration → payment request triggers  

---

## 10. Cost & ops notes

| Item | Note |
| ---- | ---- |
| Stripe fees | Per payout / Connect pricing — model vs Bill fees with finance |
| Secrets | Fewer moving parts than Bill MFA session |
| Support | Stripe Dashboard disputes/payouts vs Bill vendor portal |

---

## 11. Success criteria

- [ ] Dev test plan passed; testapp test plan passed  
- [ ] HCPs on cut-over env onboard on Stripe Connect only  
- [ ] Admin Pay-now settles via Stripe; webhook marks `PAID` / `FAILED`  
- [ ] Tax/W-9 satisfied via Stripe Express requirements (documented Tax Forms equivalent); eligibility uses `taxComplete` → `w9Submitted`  
- [ ] Bill secrets removed from that env; no Bill pay / W-9 path left  
- [ ] Historical Bill payments still readable in admin for audit  
- [ ] Check product decision documented and reflected in UI  

---

## 12. Open decisions

1. Express vs Custom Connect  
2. Drop vs offline **CHECK**  
3. Transfer API shape (platform charge → transfer vs other)  
4. Stripe test vs live keys on testapp (finance preference)  
5. Whether `preferredPaymentMethod` remains or becomes ACH-implied  

---

## 13. Related

| Doc / code | Relevance |
| ---------- | --------- |
| `backend/src/modules/payments/` | Bill implementation to replace |
| `backend/prisma/migrations/20260211000000_stripe_to_bill/` | Prior Stripe→Bill column rename |
| [integrations.md](./integrations.md) | Env var tables to update |
| [platform-cost-reduction.md](./platform-cost-reduction.md) | Broader AWS cost (orthogonal to Stripe fees) |
