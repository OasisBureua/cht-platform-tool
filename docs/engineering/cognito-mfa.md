# Cognito MFA (authenticator apps + SMS)

**Last updated:** September 2026

## Pool settings (console / Terraform)

| Environment | User pool | MFA enforcement | Methods |
|-------------|-----------|-----------------|---------|
| **dev** (`devapp`) | `cht-dev-users` | **Optional MFA** | Authenticator apps + SMS (when wired) |
| **platform** (`testapp`) | platform pool | **Optional MFA** for now | Authenticator apps + SMS (when wired) |

Keep platform on **Optional** until enrollment works for existing users. Flip to **Require MFA** only after admins (then all users) have enrolled — otherwise Cognito blocks sign-in for users without a second factor.

Terraform:
- `cognito_mfa_configuration = "OPTIONAL"`
- `enable_cognito_sms_mfa = true` → creates the Cognito→SNS IAM role (`cognito_sms_sns_caller_arn` + `cognito_sms_external_id` outputs)
- `software_token_mfa` enabled

Pool MFA / SMS wiring for existing (MRR) pools is applied by:

```bash
./scripts/cognito-sync-pool-config.sh platform   # or dev
```

That script calls `UpdateUserPool` (email/SMS config) and `SetUserPoolMfaConfig` (TOTP + SMS MFA). Your End User Messaging / SNS origination number must already be ready in the account; Cognito publishes through SNS using the IAM role.

The Cognito→SNS IAM role must allow both:
- `sns:Publish` (SNS SMS path)
- `sms-voice:SendTextMessage` (direct **AWS End User Messaging SMS** path — console default)

Missing `sms-voice:SendTextMessage` causes `InvalidSmsRoleAccessPolicyException` when Configure SMS uses End User Messaging.

If you prefer the console: Cognito → MFA → **Configure SMS** using the Terraform role ARN and ExternalId outputs (`cht-platform-cognito-sms`).

## AppConfig master switch

MFA enrollment and the soft login gate are controlled by **AWS AppConfig**, not by redeploying the app.

Hosted profile **`auth-features`** (JSON):

```json
{
  "mfa": {
    "enabled": false,
    "method": "sms"
  }
}
```

| Key | Default | Meaning |
|-----|---------|---------|
| `mfa.enabled` | `false` | When `false`, no `mfaEnrollmentRequired`, no `/mfa/setup` redirect, Settings hides enrollment, and MFA setup APIs return 403. |
| `mfa.method` | `"sms"` | `"sms"` → phone collect/verify UI; `"totp"` → authenticator QR UI. Login still accepts whichever challenge Cognito returns (`SMS_MFA` or `SOFTWARE_TOKEN_MFA`). |

**Local / missing AppConfig:** backend treats MFA as **disabled**.

**Enable after SMS is live:** set `"enabled": true` in AppConfig and deploy the configuration. No app redeploy required.

## Phone numbers

SMS MFA requires a **verified Cognito `phone_number`** (E.164). The app:

1. Collects a US mobile on `/mfa/setup` when `method` is `sms`
2. Calls Cognito `UpdateUserAttributes` + attribute verification SMS
3. On verify, enables preferred **SMS MFA** and stores `User.phoneNumber` in Postgres for profile/display

Cognito remains the source of truth at challenge time. Postgres is a mirror for Settings / future intake autofill.

## App behavior

1. **Login (already enrolled)** — Cognito returns `SOFTWARE_TOKEN_MFA` or `SMS_MFA`; client completes via `POST /auth/cognito/mfa` with `challenge`.
2. **Login (Require MFA, not enrolled)** — `MFA_SETUP` → TOTP associate path (unchanged).
3. **Enrollment (Optional + AppConfig on)**  
   - SMS: `POST /auth/mfa/phone/start` → `POST /auth/mfa/phone/verify`  
   - TOTP: `POST /auth/mfa/setup` → `POST /auth/mfa/verify`
4. Soft enrollment gate + Settings copy follow AppConfig `mfa.enabled` / `mfa.method`.

## When to enable MFA (AppConfig + Cognito)

1. Apply Terraform (`enable_cognito_sms_mfa`) and run `cognito-sync-pool-config.sh`.
2. Confirm SMS sends (sandbox / production spend limit / 10DLC as required by AWS).
3. Set AppConfig `mfa.enabled` to `true`.
4. Have users enroll (SMS by default).
5. When ready for hard enforcement: Cognito → **Require MFA**.

## Related

- `infrastructure/terraform/modules/security/cognito/sms.tf` — Cognito→SNS IAM role
- `scripts/cognito-sync-pool-config.sh` — MRR-safe pool MFA/SMS sync
- `backend/src/auth/cognito.service.ts` — SMS + TOTP challenge/enrollment
- `frontend/src/pages/public/MfaSetup.tsx`, `Login.tsx`
