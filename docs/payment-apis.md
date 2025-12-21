# Payment APIs Documentation

## Overview

The payment system uses Stripe Connect to handle user payments. Users complete W9 forms through Stripe's onboarding, and payments are processed via Stripe transfers.

## Endpoints

### Create Connect Account
```
POST /api/payments/:userId/connect-account
```

Creates a Stripe Connect Express account for the user and returns an onboarding URL.

**Response:**
```json
{
  "accountId": "acct_xxx",
  "onboardingUrl": "https://connect.stripe.com/setup/...",
  "accountStatus": "onboarding_incomplete"
}
```

---

### Get Account Status
```
GET /api/payments/:userId/account-status
```

Returns the user's payment account status.

**Response:**
```json
{
  "hasAccount": true,
  "accountId": "acct_xxx",
  "accountStatus": "active",
  "paymentEnabled": true,
  "w9Submitted": true,
  "w9SubmittedAt": "2024-12-20T...",
  "totalEarnings": 500,
  "chargesEnabled": true,
  "payoutsEnabled": true,
  "detailsSubmitted": true
}
```

---

### Create Payout
```
POST /api/payments/payout
```

Creates a payout to a user (admin only - auth will be added later).

**Request Body:**
```json
{
  "userId": "user_xxx",
  "programId": "program_xxx",
  "amount": 50000,
  "description": "Honorarium for program completion"
}
```

**Response:**
```json
{
  "paymentId": "payment_xxx",
  "amount": 50000,
  "status": "PAID",
  "transferId": "tr_xxx"
}
```

---

### Refresh Account Link
```
POST /api/payments/:userId/account-link
```

Generates a new onboarding URL (if user's link expired).

**Response:**
```json
{
  "url": "https://connect.stripe.com/setup/...",
  "expiresAt": 1234567890
}
```

---

### Sync Account Status
```
POST /api/payments/:userId/sync-account
```

Manually syncs account status from Stripe (for testing without webhooks).

**Response:**
```json
{
  "userId": "user_xxx",
  "stripeAccountId": "acct_xxx",
  "previousStatus": "onboarding_incomplete",
  "newStatus": "active",
  "paymentEnabled": true,
  "w9Submitted": true
}
```

---

## Stripe Setup

### Test Mode

1. Get test API keys from Stripe Dashboard
2. Add to `.env`:
```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
```

3. Test onboarding:
   - SSN: 0000
   - Routing: 110000000
   - Account: 000123456789

### Production Mode

1. Business verification (1-2 days)
2. Apply for Stripe Connect (1-3 days)
3. Get live API keys
4. Configure webhook endpoint: `https://api.chtplatform.com/webhooks/stripe`
5. Update `.env` with live keys

---

## Payment Flow

1. User creates account → `POST /payments/:userId/connect-account`
2. User completes Stripe onboarding (W9, bank info)
3. Stripe webhook updates account status
4. Admin processes payout → `POST /payments/payout`
5. Stripe transfers money to user's bank
6. Database updated with payment record

---

## Cost

- Stripe Connect: 0.25% per payout
- No monthly fees
- Free 1099 generation
- Example: $500 payout = $1.25 fee

---

## Security

- W9 data stored in Stripe (encrypted)
- No SSN/EIN in our database
- Stripe handles identity verification
- All transfers logged in database
