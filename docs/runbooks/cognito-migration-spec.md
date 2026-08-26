# Runbook: Cognito Auth Migration

Replace GoTrue (MediaHub) as the CHT platform IdP with Amazon Cognito.

**When to run:** Phase 2, after staging teardown, before Phase 3 (stable dev env).

**Owner:** Uche Aduakaa  
**Reviewer:** Adaze Oviawe  
**Target cutover:** July 7, 2026 (platform environment)  
**Status:** In progress

---

## Architecture decisions (locked)

| Decision | Choice |
| -------- | ------ |
| Pool structure | One pool per environment, groups inside |
| Groups (now) | `cht-hcp`, `cht-admin` |
| Groups (later) | `cht-kol`, `cht-industry`: add `aws_cognito_user_group` resource, no pool migration |
| Domain prefix | `chm-platform` (platform), `chm-platform-dev` (dev) |
| App client | `cht-web`: PKCE public client (no secret) |
| Google OAuth | Cognito Hosted UI; wired in when Google Cloud creds are ready |
| Email/password | Custom CHT login pages; backend proxies Cognito `InitiateAuth` via SRP |
| MFA | `OPTIONAL` at launch → flip to `ON` via Terraform at day 14 |
| New signups | Open immediately on platform pool |
| Session strategy | Postgres sessions + httpOnly cookies unchanged; Cognito issues JWTs, backend exchanges for session |
| Active sessions at cutover | Invalidate all at maintenance window start (users re-login) |
| Chatbot at cutover | Degrades gracefully: fix chatbot JWT post-cutover |
| MediaHub coordination | Confirmed: MediaHub will not create CHT end-users or control CHT auth |

---

## Timeline

| Week | Dates | Goal |
| ---- | ----- | ---- |
| Week 1 | Jun 17–21 | Terraform: pools provisioned in dev; backend auth compiles with Cognito strategy |
| Week 2 | Jun 24–28 | Frontend: PKCE flow works end-to-end in dev; login/join pages updated |
| Week 3 | Jul 1–5 | User migration dry run in dev; platform pre-flight complete |
| Cutover | Jul 7 | Platform maintenance window; GoTrue decommissioned |
| Day 14 | Jul 21 | MFA flip `OPTIONAL` → `ON` via Terraform |

---

## Phase 1: Terraform (Week 1)

### Step 1.1: Apply dev pool

```bash
cd infrastructure/terraform/environments/us-east-1
terraform init
terraform plan -var-file=../variables/dev.tfvars -out=cognito-dev.plan
terraform apply cognito-dev.plan
```

**Exit criteria:**
- `chm-platform-dev` Hosted UI domain resolves: `https://chm-platform-dev.auth.us-east-1.amazoncognito.com`
- `terraform output cognito_user_pool_id` returns a pool ID
- Groups `cht-hcp` and `cht-admin` visible in AWS Console → Cognito → User Pools

### Step 1.2: Apply platform pool

```bash
terraform plan -var-file=../variables/platform.tfvars -out=cognito-platform.plan
terraform apply cognito-platform.plan
```

**Exit criteria:** Same as dev but for `chm-platform`.

### Step 1.3: Verify client config

In AWS Console → Cognito → User Pools → `cht-platform-users` → App clients:
- `cht-web` client present
- No client secret (public PKCE)
- Callback URL: `https://testapp.communityhealth.media/auth/callback`
- Logout URL: `https://testapp.communityhealth.media`
- Allowed flows: Authorization code grant
- Scopes: email, openid, profile
- Token revocation enabled; auth flow session 3 minutes

### Step 1.4: Configure auth email (SES)

By default Terraform uses `COGNITO_DEFAULT` (`no-reply@verificationemail.com`). For branded verification and password-reset emails, switch to SES in `dev.tfvars` / `platform.tfvars`:

```hcl
cognito_email_sending_account = "DEVELOPER"
cognito_email_from            = "noreply@communityhealth.media"
cognito_email_reply_to        = "info@communityhealth.media"
```

**Prerequisite:** `communityhealth.media` (or the FROM address) must already be verified in **Amazon SES → us-east-1** (same region as the user pool). The worker already sends from `info@communityhealth.media`; reuse that verified domain.

After apply, confirm in Cognito → **Authentication methods → Email**:
- Email provider: **Send email with Amazon SES**
- SES Region: **US East (N. Virginia)**
- FROM: your `cognito_email_from` value

### Step 1.5: WAF on Cognito user pool

Set in `dev.tfvars` / `platform.tfvars`:

```hcl
enable_cognito_waf = true
```

Terraform creates a **REGIONAL** WAF ACL (rate limit + AWS managed rules) and associates it with the user pool. Confirm in Console → Cognito → **AWS WAF** → Status **Active**.

Note: AWS WAF Fraud Control (ATP) rule groups are **not** supported on Cognito user pools.

### Step 1.6: Multi-Region replication (optional DR)

Requires **ESSENTIALS** or **PLUS** tier. Terraform creates multi-Region KMS keys in us-east-1 + us-east-2 (with Cognito + Identity Store key policy). Complete pool replication via script (MRR APIs not yet in Terraform AWS provider 5.x):

```hcl
enable_cognito_mrr         = true
cognito_mrr_replica_region = "us-east-2"
```

**Prerequisite: CMK + KMS replica:** MRR requires a **customer-managed multi-Region KMS key** on the user pool and the same MRK replicated to the target Region with a key policy allowing `cognito-idp.amazonaws.com` and `identitystore.amazonaws.com`. Terraform creates both when `enable_cognito_mrr = true` is applied. Cognito `UpdateUserPool` resets omitted fields: the MRR script sends `KeyConfiguration` on every update so the CMK is not cleared when switching the OIDC issuer.

```bash
./scripts/deploy-primary.sh dev          # creates KMS keys + primary WAF
./scripts/cognito-setup-mrr.sh dev       # attach CMK, update issuer, create replica
# After replica is ACTIVE in Console:
# cognito_mrr_associate_waf_replica = true
./scripts/deploy-primary.sh dev          # associates WAF in us-east-2
```

The MRR script uses raw Cognito JSON API calls (AWS CLI/boto3 service models may lag the June 2026 MRR APIs). If KMS attach fails with `kms:DescribeKey`, re-apply primary Terraform so the MRK policy includes `cognito-idp.amazonaws.com` and `identitystore.amazonaws.com`.

**Terraform note:** With MRR enabled, `aws_cognito_user_pool` uses `lifecycle { ignore_changes = all }` because AWS provider 5.x cannot send `KeyConfiguration` on updates. After `./scripts/deploy-primary.sh`, `scripts/cognito-sync-pool-config.sh` applies email/verification/CMK/issuer settings via the MRR-safe API.

**Important:** Switching to the multi-Region OIDC issuer changes the `iss` claim on new tokens. Backend JWKS validation uses pool ID and should continue to work, verify login after MRR setup.

MRR adds per-MAU cost. TOTP MFA is **not** supported on secondary replicas during normal operation.

---

## Phase 2: Backend (Week 1–2)

Files to create/modify (tracked in separate session):

| File | Change |
| ---- | ------ |
| `backend/src/config/configuration.ts` | Add `cognito` config block (pool ID, client ID, region) |
| `backend/src/auth/cognito.strategy.ts` | New: JWKS validation against Cognito JWKS URI |
| `backend/src/auth/auth.module.ts` | Register `CognitoStrategy`; keep `GoTrueStrategy` until cutover flag is on |
| `backend/src/auth/auth.controller.ts` | Add `/auth/cognito/login`, `/auth/cognito/callback`, `/auth/logout` |
| `backend/src/auth/auth.service.ts` | `findOrCreateByCognitoSub`: maps `sub` claim → `User.authId` |
| `backend/.env.example` | Add `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_REGION` |

**Auth flow (email/password):**
1. Frontend POSTs credentials to `POST /api/auth/cognito/login`
2. Backend calls Cognito `InitiateAuth` (USER_SRP_AUTH or USER_PASSWORD_AUTH)
3. Cognito returns tokens; backend validates JWT, creates Postgres session
4. Backend sets httpOnly session cookie, identical to current GoTrue flow

**Auth flow (Google OAuth):**
1. Frontend redirects to Cognito Hosted UI `/oauth2/authorize?identity_provider=Google&...`
2. User authenticates with Google; Cognito returns `?code=` to `/auth/callback`
3. Frontend sends code to `POST /api/auth/cognito/callback`
4. Backend exchanges code → tokens, validates JWT, creates session

**Feature flag:** Read `COGNITO_USER_POOL_ID` env var. If set → use Cognito strategy. If not → fall back to GoTrue. This lets dev and platform cut over independently.

**Exit criteria:**
- `POST /api/auth/cognito/login` returns a session cookie in dev
- Existing GoTrue session cookie still works (no regression)
- `GET /api/me` returns user profile with Cognito-backed session
- MFA challenge handled: backend returns `{ challenge: 'SOFTWARE_TOKEN_MFA', session }` for frontend to prompt TOTP

---

## Phase 3: Frontend (Week 2)

Files to create/modify (tracked in separate session):

| File | Change |
| ---- | ------ |
| `frontend/src/lib/cognito-oauth.ts` | New: builds Cognito Hosted UI authorize URL with PKCE; handles code exchange |
| `frontend/src/pages/public/AuthCallback.tsx` | Update: handle `?code=` (not GoTrue hash `#access_token=`) |
| `frontend/src/pages/public/Login.tsx` | Email/password → `POST /api/auth/cognito/login`; Google button → Hosted UI |
| `frontend/src/pages/public/Join.tsx` | Sign-up → `POST /api/auth/cognito/signup` |
| `frontend/src/pages/public/AdminLogin.tsx` | Same pattern as Login |
| `frontend/src/contexts/AuthContext.tsx` | Remove GoTrue JWT from state; session-cookie-only auth |
| `frontend/.env.example` | Add `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID` |

**Exit criteria:**
- Email/password login creates a session in dev end-to-end
- Google OAuth button redirects to Cognito Hosted UI and returns to `/auth/callback`
- Join flow creates a Cognito user and a CHT `User` row
- Logout clears the Postgres session

---

## Phase 4: User migration (Week 3, before cutover)

### Who gets migrated

All `User` rows with a non-null `authId` (GoTrue UUIDs). Users without `authId` (SSO-only) are excluded.

### Migration script (dry run first)

```bash
# Export from GoTrue (MediaHub will provide this)
# Input: users.json from GoTrue admin API

# Dry run, prints what would happen, no writes
npx ts-node scripts/migrate-users-to-cognito.ts --dry-run

# Live run against dev pool first
COGNITO_USER_POOL_ID=us-east-1_XXXXXX \
npx ts-node scripts/migrate-users-to-cognito.ts --pool dev
```

**What the script does:**
1. For each GoTrue user: call Cognito `AdminCreateUser` with `SUPPRESS` (no welcome email)
2. Set `temporaryPassword` = random; immediately call `AdminSetUserPassword` with `permanent: true`
3. Update `User.authId` in CHT DB from GoTrue UUID → Cognito `sub`
4. Log any failures (email conflicts, etc.)

**Exit criteria: dev dry run:**
- All users accounted for (count matches GoTrue export)
- No duplicate email errors
- `User.authId` updated in dev DB

**Exit criteria: platform migration:**
- Script completes with 0 errors
- Sample 5 users can log in via Cognito with their existing password (GoTrue passwords are BCrypt, Cognito import does not carry them over; see password reset note below)

> **Password note:** Cognito cannot import GoTrue password hashes directly. Platform users will receive a one-time password reset email at the maintenance window. The cutover email (see below) explains this.

---

## Cutover procedure (July 7, maintenance window)

**Duration:** 30–60 min  
**Window:** Saturday Jul 5 or Monday Jul 7, 10 PM EDT  
**Pre-req:** Phase 1–3 complete; migration dry run passed

### T-48h: pre-flight
- [ ] Dev end-to-end tested by two people
- [ ] Migration script dry-run passed on platform GoTrue export
- [ ] Rollback plan reviewed (see below)
- [ ] `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` staged in Secrets Manager (not yet active)
- [ ] GoTrue secrets still in Secrets Manager (do not delete)

### T-0: maintenance window start
1. Post in-app banner: "We're doing a quick security upgrade. Please save your work."
2. Set ECS env var `MAINTENANCE_MODE=true`: returns 503 on auth endpoints
3. Invalidate all Postgres sessions: `DELETE FROM sessions;`
4. Run migration script against platform pool (live)
5. Verify: 5 random users exist in Cognito console
6. Rotate ECS task definition: swap `GOTRUE_JWT_SECRET` → `COGNITO_USER_POOL_ID` + `COGNITO_CLIENT_ID`
7. Deploy new backend image (Cognito strategy active)
8. Deploy new frontend (Cognito login pages)
9. Smoke test: log in with a test account via Cognito
10. Set `MAINTENANCE_MODE=false`
11. Send password reset email to all users: "Your account has been upgraded. Please reset your password to continue."

### T+1h: health check
- [ ] `GET /health/ready` → 200
- [ ] 5 manual logins confirmed
- [ ] Error rate in CloudWatch < 1%
- [ ] GoTrue containers still running (do not stop yet)

---

## Rollback plan (48h window)

If a P0 issue is detected within 48h of cutover:

1. `MAINTENANCE_MODE=true`
2. Invalidate all Postgres sessions: `DELETE FROM sessions;`
3. Roll back ECS task definition to previous revision (GoTrue env vars restored)
4. Roll back frontend to previous CloudFront distribution
5. `MAINTENANCE_MODE=false`
6. Send email: "We've rolled back to the previous version. Your original password works again."
7. Conduct post-mortem before rescheduling

**GoTrue secrets are kept in Secrets Manager until 48h window closes.**

---

## Day 14: MFA flip (July 21)

Flip MFA from `OPTIONAL` to `ON` via Terraform:

```hcl
# platform.tfvars
cognito_mfa_configuration = "ON"
```

```bash
cd infrastructure/terraform/environments/us-east-1
terraform plan -var-file=../variables/platform.tfvars -out=mfa-on.plan
terraform apply mfa-on.plan
```

In-app nudge (added in Phase 3): "Enable TOTP MFA in your security settings before July 21."

---

## MediaHub decommission (parallel, not blocking cutover)

Per [mediahub-auth-decommission-checklist.md](./mediahub-auth-decommission-checklist.md):

- MediaHub `GoTrue` will no longer serve CHT end-users after cutover
- MediaHub `X-API-Key` server-to-server (HCP upsert, catalog) is unchanged
- MediaHub will NOT create or own CHT user accounts

---

## Google OAuth: wiring in (when creds are ready)

1. Create OAuth client in Google Cloud Console → Credentials
   - Authorized redirect URI: `https://chm-platform.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
2. Add to `platform.tfvars`:
   ```hcl
   cognito_google_client_id     = "YOUR_CLIENT_ID.apps.googleusercontent.com"
   cognito_google_client_secret = "YOUR_CLIENT_SECRET"
   ```
3. `terraform apply`: this creates `aws_cognito_identity_provider.google`
4. Frontend Google button URL already targets Hosted UI with `identity_provider=Google`: no frontend change needed

---

## Sign-off

| Runbook | Owner | Reviewer | Approved date |
| ------- | ----- | -------- | ------------- |
| cognito-migration-spec | Uche Aduakaa | Adaze Oviawe |: |
