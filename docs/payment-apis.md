# Payment APIs Documentation

## Overview

The payment system uses **Bill.com** to handle user payments:

1. **User onboarding:** Users provide bank details; backend creates a Bill.com vendor.
2. **Earnings recorded:** Program completions and survey bonuses queue payment messages; worker records `Payment` rows with `status=PENDING` (no Bill.com call yet).
3. **Admin pays:** Admins see pending payments in Admin → Payments, click **Pay now** to send via Bill.com (ACH or check). W-9 must be verified in Bill.com before paying.

## Endpoints

### Create Connect Account
```
POST /api/payments/:userId/connect-account
```

Creates a Bill.com vendor for the user. Optionally accepts bank details in the request body to complete onboarding.

**Optional body (CreateVendorDto):**
```json
{
  "payeeName": "John Doe",
  "bankAccount": {
    "nameOnAccount": "John Doe",
    "accountNumber": "111222333",
    "routingNumber": "074000010"
  },
  "addressLine1": "123 Main St",
  "city": "San Jose",
  "state": "CA",
  "zipCode": "95002"
}
```

**Response:**
```json
{
  "accountId": "009xxx",
  "onboardingUrl": "https://app.bill.com/...",
  "accountStatus": "active"
}
```

---

### Get Pending Payments (admin)
```
GET /api/payments/pending
```

Returns all payments with `status=PENDING` for the admin "Pay now" flow.

---

### Pay Now (admin)
```
POST /api/payments/:paymentId/pay-now
```

For a PENDING payment: creates payment in Bill.com, updates record to PAID, increments user earnings.

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
  "accountId": "009xxx",
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

### Sync Account Status
```
POST /api/payments/:userId/sync-account
```

Manually syncs account status from Bill.com.

---

## Bill.com Setup

**API Documentation:** [developer.bill.com/reference/api-reference-overview](https://developer.bill.com/reference/api-reference-overview)

1. Sign up at [developer.bill.com](https://developer.bill.com)
2. Developer key is provided by the team (e.g. `01LQJPNSALIQKDZM5289`)
3. Get your Organization ID (Settings → Sync & Integrations → Manage Developer Keys, at bottom)
4. Configure bank account for funding in Bill.com; get the funding account ID from Bill.com (used for payouts)
5. **MFA:** Creating payments requires an MFA-trusted API session. Enable MFA trust for the API in Bill.com (see MFA setup in the API reference)
6. Add to `.env`:

**Option A: Auto-login (recommended)** – Backend calls Bill.com Login API when needed; session auto-refreshes on 401.
```
BILL_DEV_KEY=your_developer_key
BILL_USERNAME=your_bill_account_email
BILL_PASSWORD=your_bill_account_password
BILL_ORG_ID=008xxxxx
BILL_FUNDING_ACCOUNT_ID=your_funding_account_id
```

**Option B: Manual session** – Set session manually; expires after 35 min of inactivity.
```
BILL_DEV_KEY=your_developer_key
BILL_SESSION_ID=session_from_login_api
BILL_ORG_ID=008xxxxx
BILL_FUNDING_ACCOUNT_ID=your_funding_account_id
```

**Getting session ID manually (if needed):**
```bash
curl -X POST https://gateway.stage.bill.com/connect/v3/login \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_EMAIL","password":"YOUR_PASSWORD","organizationId":"008xxxxx","devKey":"YOUR_DEV_KEY"}'
```
Response: `{"sessionId":"...","organizationId":"...","userId":"..."}`

## Payment Flow

1. **User onboarding:** User provides bank details; backend creates vendor in Bill.com.
2. **Worker records PENDING:** Program/survey completion → SQS → worker creates `Payment` with `status=PENDING` (no Bill.com call).
3. **Admin clicks Pay now:** Admin sees pending list at `/admin/payments`, clicks **Pay now** → backend calls Bill.com API → payment marked `PAID`, `totalEarnings` updated.
4. Bill.com sends funds to the user's bank (ACH) or issues a check.

## Admin "Pay now" Flow

- **GET /api/payments/pending** (admin) – Lists all PENDING payments with user/program info.
- **POST /api/payments/:paymentId/pay-now** (admin) – For a PENDING payment: creates payment in Bill.com, updates record to PAID, increments user earnings.
- Admins verify W-9 in Bill.com before paying; payment method (ACH vs check) is configured in Bill.com.

## Payment Queue & Worker

Program completions and survey bonuses queue `PROCESS_PAYMENT` messages to SQS. The **payment worker** consumes these but **does not call Bill.com**. It records `Payment` rows with `status=PENDING`. Admins then use the **Pay now** button to send via Bill.com.
