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

## Test Bill.com Connection

**Funding account ID is not required** for testing. Only org ID, username, password, and dev key are needed.

```
GET /api/payments/test-connection
```
(Admin only, requires auth.) Returns `{ success: true, organizationId: "00802JRVLQNWWQB3hgkt" }` on success.

**Organization ID:** `00802JRVLQNWWQB3hgkt`

**Funding account ID** (required for **Pay now**): Use the org bank account BILL should debit for AP payables. You can get it in the app (Settings → Bank & Payment Accounts) or **via API**: `GET https://gateway.stage.bill.com/connect/v3/funding-accounts/banks` (or prod host) with `devKey` + `sessionId` from `POST .../login`. Each account’s `id` usually starts with `bac`; pick the one with `default.payables: true` for payouts.

**Backend helper (admin or dev):**
```
GET /api/payments/bill-funding-accounts
```
Returns the same list as the API (`results` with `id`, `status`, `default`, `bankName`, etc.). Set `BILL_FUNDING_ACCOUNT_ID` to the chosen `id`.

---

## Bill.com Setup

**API Documentation:** [developer.bill.com/reference/api-reference-overview](https://developer.bill.com/reference/api-reference-overview)

1. Sign up at [developer.bill.com](https://developer.bill.com)
2. Developer key is provided by the team (e.g. `01LQJPNSALIQKDZMxxxxxxxx`)
3. Get your Organization ID (Settings → Sync & Integrations → Manage Developer Keys, at bottom)
4. Configure bank account for funding in Bill.com; get the funding account ID from Bill.com (used for payouts)
5. **MFA for Pay now:** Bill.com returns **BDC_1361** without an MFA-trusted session. Prefer **`BILL_SESSION_ID`** (e.g. Lambda-updated app secret **`bill_session_id`**) or **`BILL_MFA_REMEMBER_ME_ID` + `BILL_MFA_DEVICE_NAME`**. When **`BILL_SESSION_ID`** is set, the backend **uses it first** and calls **`GET /v3/login/session`** for `userId` and MFA status ([session info](https://developer.bill.com/reference/getsessioninfo)).
6. Add to `.env` or Secrets Manager:

**Option A — Remember-me + password** (no session rotation in Secrets Manager).

**Option B — Session `BILL_SESSION_ID`** (Lambda can update **`bill_session_id`** in the app secret and recycle ECS tasks). Keep **`BILL_DEV_KEY`**, **`BILL_ORG_ID`**, **`BILL_FUNDING_ACCOUNT_ID`**. Omit **`BILL_USERNAME`** / **`BILL_PASSWORD`** if you do not want automatic fallback to password login after 401/403 (that fallback session may still be **untrusted** for Pay now). *Lambda should invoke your **backend** `POST /api/payments/.../pay-now`; it should **not** embed Bill secrets unless you deliberately build a second integration.*

`GET /api/payments/test-connection` returns **`mfaTrusted`** and **`sessionFromEnv`** (true when **`BILL_SESSION_ID`** was used at startup).

**Option A detail — Auto-login with remember-me**

**Pay now** (`POST /v3/payments`) is an [MFA-trusted operation](https://developer.bill.com/reference/login). Username/password login alone returns `trusted: false` until you pass **`rememberMeId`** + **`device`** on `POST /v3/login`:

1. Call `POST /v3/login` (username, password, organizationId, devKey).
2. Run the MFA challenge / validate flow (see [MFA validate challenge](https://developer.bill.com/reference/validatechallenge)); use **`rememberMe: true`** in the validate request so the response includes an MFA **remember-me id** (~30 days).
3. Set stable env vars and redeploy:
```
BILL_MFA_REMEMBER_ME_ID=<id_from_validate_response>
BILL_MFA_DEVICE_NAME=api-server-1
```
(`BILL_MFA_DEVICE_NAME` is a label you choose; it must always pair with the same remember-me id.)

4. Keep the normal credentials:
```
BILL_DEV_KEY=your_developer_key
BILL_USERNAME=your_bill_account_email
BILL_PASSWORD=your_bill_account_password
BILL_ORG_ID=008xxxxx
BILL_FUNDING_ACCOUNT_ID=your_funding_account_id
```

`GET /api/payments/test-connection` returns **`mfaTrusted`** so you can confirm before Pay now.

**Option B — Session only (manual or Lambda-updated secret):** Same env as below; **`BILL_SESSION_ID`** must be from a **trusted** login (`trusted: true` or session info `mfaStatus` COMPLETE / DISABLED / dev-key `mfaBypass`).
```
BILL_DEV_KEY=your_developer_key
BILL_SESSION_ID=session_from_trusted_login_api
BILL_ORG_ID=008xxxxx
BILL_FUNDING_ACCOUNT_ID=your_funding_account_id
```

**Getting session ID manually (if needed):**
```bash
curl -X POST https://gateway.stage.bill.com/connect/v3/login \
  -H "Content-Type: application/json" \
  -d '{"username":"YOUR_EMAIL","password":"YOUR_PASSWORD","organizationId":"008xxxxx","devKey":"YOUR_DEV_KEY","rememberMeId":"YOUR_REMEMBER_ME_ID","device":"api-server-1"}'
```
Response: `{"sessionId":"...","organizationId":"...","userId":"...","trusted":true}`

### How to get a trusted `sessionId` (what the payment curl needs)

Bill’s sample `POST /v3/payments` is correct: **`devKey`** and **`sessionId`** headers plus the JSON body. **`sessionId` must come from a session Bill considers MFA-trusted** for that org. If it is not, you get **BDC_1361 Untrusted session** even though the curl shape is right.

**1. Quick check after any login**

**Bill.com — Get API session details** ([reference](https://developer.bill.com/reference/getsessioninfo))

- **Method / URL:** `GET https://gateway.stage.bill.com/connect/v3/login/session` (production: `https://gateway.prod.bill.com/connect/v3/login/session`)
- **Headers:** `sessionId` (from `POST /v3/login`), `devKey` (developer key)
- **200 response body (summary):**

| Field | Meaning |
|--------|--------|
| `organizationId` | Current org |
| `userId` | Current user |
| `mfaStatus` | Org MFA state (see enum below) |
| `mfaBypass` | `true` when MFA is **disabled at the developer key**; orgs on that key skip MFA |

**`mfaStatus` enum (Bill):**

- **`DISABLED`** — MFA is disabled for the organization.  
- **`SETUP`** — MFA setup incomplete; validate phone to finish.  
- **`CHALLENGE`** — MFA setup complete; **challenge required** for MFA sign-in (session not payment-trusted until resolved).  
- **`COMPLETE`** — Setup and sign-in complete; **this API session is MFA-trusted** (what you need for `POST /v3/payments`).  
- **`UNDEFINED`** — Undefined / not classified.

**Example (stage):**

```bash
curl -sS 'https://gateway.stage.bill.com/connect/v3/login/session' \
  -H "devKey: YOUR_DEV_KEY" \
  -H "sessionId: YOUR_SESSION_ID"
```

The backend calls this after startup when **`BILL_SESSION_ID`** is set; check logs for `Bill.com GET /login/session: mfaStatus=...` or use **`GET /api/payments/test-connection`** for **`mfaTrusted`**.

For Pay now, your session is in good shape when **`mfaBypass`** is **`true`**, or **`mfaStatus`** is **`COMPLETE`** or **`DISABLED`** (confirm org policy with Bill if you rely on DISABLED); **`SETUP`** / **`CHALLENGE`** mean you still need MFA steps before payments.

**2. If plain `POST /v3/login` returns `"trusted": false`**

Password-only login often creates a session that can list vendors but **cannot** pay. You must complete Bill’s **MFA-trusted** path once per “trust boundary,” then reuse the resulting **`sessionId`** (rotated ~every **35 minutes of inactivity**, or when Bill invalidates it):

- **API (automatable):** MFA **challenge** → **validate** with the code from the user’s device. After validation, call **`POST /v3/login`** again as Bill documents; the response should include **`"trusted": true`** and a new **`sessionId`**. Use that value as **`BILL_SESSION_ID`**. See [MFA validate challenge](https://developer.bill.com/reference/validatechallenge) and [API login](https://developer.bill.com/reference/login).  
- **Remember-me (less frequent MFA):** After validate with **`rememberMe: true`**, Bill returns a **remember-me id**; put **`rememberMeId`** + **`device`** on **`POST /v3/login`** so each new **`sessionId`** is trusted without repeating the SMS/app step until that id expires (~30 days). That is what **`BILL_MFA_REMEMBER_ME_ID`** + **`BILL_MFA_DEVICE_NAME`** automate on the server.

**3. Storing and rotating**

- Copy **`sessionId`** from the response where **`trusted`** is **`true`** (or confirm with **`GET /v3/login/session`**).  
- Put it in **`BILL_SESSION_ID`** / Secrets Manager **`bill_session_id`**, then **restart or redeploy ECS** so tasks read the new value.  
- Automations (Lambda) repeat login + MFA (or remember-me login) before expiry and update the secret again.

**4. Our backend vs the sample payment body**

The platform’s **Pay now** uses **`createBill: true`** and does **not** pass **`billId`** (Bill auto-generates a bill for the vendor payment). The doc sample uses an existing **`billId`** and **`createBill: false`**—equivalent idea (pay a vendor), different shape.

### Session `sessionId` TTL and Lambda rotation

Per [Bill.com authentication overview](https://developer.bill.com/v2/docs/authentication-overview) and login docs, a **v3 `sessionId` expires after ~35 minutes of inactivity** (idle). **Any successful API call with that session typically resets the idle clock**—so TTL is not “wall clock from login,” it’s “time since last Bill API activity with that session.”

| Artifact | Typical lifetime |
|----------|-------------------|
| **`sessionId`** | ~**35 min idle**; refreshed by activity (e.g. `GET /v3/login/session`, list funding accounts, payments). |
| **`rememberMeId`** (optional) | Bill documents **~30 days**; used on `POST /v3/login` to mint new **`sessionId`**s without repeating SMS/app MFA each time. |

**How often to rotate (if you only store `sessionId` in Secrets Manager):**

- **Low traffic (Pay now rarely, long gaps between Bill calls):** Proactively mint a new trusted session on a schedule **under** the idle window—e.g. **EventBridge every 20–25 minutes** writing a fresh **`sessionId`** into the secret—**or** rotate **on failure** when Bill returns invalid session / **BDC_1109** / **BDC_1361** and your backend/Lambda retries login.
- **Steady Bill API usage:** You may rotate less often in practice because the backend keeps extending the session; still handle expiry in code paths that can sit idle.

**Lambda pattern (lightweight):**

1. Read **`BILL_USERNAME`**, **`BILL_PASSWORD`**, **`BILL_ORG_ID`**, **`BILL_DEV_KEY`** (from Secrets Manager / SSM) **or** use **`rememberMeId` + `device`** with password if you want minimal MFA prompts.
2. **`POST /v3/login`** → verify **`trusted: true`** (or **`GET /v3/login/session`** → **`mfaStatus`** **`COMPLETE`** / **`mfaBypass`** / org **`DISABLED`** as appropriate).
3. **`PutSecretValue`** (or update JSON key **`bill_session_id`**) with the new **`sessionId`**.
4. **ECS does not hot-reload** injected secrets: after updating the secret, **start new tasks** (e.g. `UpdateService` force deployment, or bump task definition) so **`BILL_SESSION_ID`** is re-read—or run the Lambda **only** to heal “next deploy” if you accept manual recycle for rare Pay now.

For Pay-now reliability with sparse traffic, **remember-me login on the Lambda** (same **`BILL_MFA_REMEMBER_ME_ID`** / **`BILL_MFA_DEVICE_NAME`** as the server) usually beats polling **`POST /login`** with full MFA every 20 minutes.

### App startup, lazy login, and Secrets Manager

**We do not call Bill on application startup.** There is no `OnModuleInit` login. The first time this process needs Bill (e.g. **Pay now**, **test-connection**, **vendor** calls, **Elements** session), `ensureSession()` runs and either:

- uses **`BILL_SESSION_ID`** already injected into the container env (copied into **`BillService`** memory at construct time), or  
- calls **`POST /v3/login`** with username/password and, when configured, **`rememberMeId`** + **`device`**.

**Where `sessionId` lives:** always **in memory** inside the backend task after login or hydration. Secrets Manager is not a runtime session store—it only provides **initial env** (and optional **`bill_session_id`**) when the task boots.

**Without `rememberMeId` / `device`:** each password-only login typically returns **`trusted: false`**, so **Pay now** stays blocked (**BDC_1361**) until you add remember-me credentials or inject a **trusted** `BILL_SESSION_ID`.

**Should you store `sessionId` in Secrets Manager?**

| Store in Secrets Manager | Typical use |
|-------------------------|-------------|
| **Username, password, org, dev key, funding account** | Yes — long-lived, standard. |
| **`rememberMeId` + `device`** | **Recommended** for server-side **MFA-trusted** `POST /login` without pasting a new `sessionId` every ~35 min idle. Remember-me id is on the order of **~30 days** per Bill. |
| **Raw `sessionId` (`bill_session_id`)** | **Optional.** Use when a **Lambda** (or human) mints a trusted session and you want **every new ECS task** to start with that string—knowing tasks **won’t** see updates until redeploy/new task. Often **less** attractive than remember-me + in-memory session per task. |

**Practical default for your app:** keep **no** `bill_session_id` in Terraform if you adopt **`BILL_MFA_REMEMBER_ME_ID`** + **`BILL_MFA_DEVICE_NAME`** + password; let each task obtain a **trusted** `sessionId` in memory on first Bill use. Add **`bill_session_id`** only if you explicitly want the Lambda-rotated shared-session pattern.

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
