# Cognito MFA (authenticator apps)

**Last updated:** August 2026

## Pool settings (console)

| Environment | User pool | MFA enforcement | Methods |
|-------------|-----------|-----------------|---------|
| **dev** (`devapp`) | `cht-dev-users` | **Optional MFA** | Authenticator apps |
| **platform** (`testapp`) | platform pool | **Optional MFA** for now | Authenticator apps |

Keep platform on **Optional** until enrollment works for existing users. Flip to **Require MFA** only after admins (then all users) have enrolled — otherwise Cognito blocks sign-in for users without TOTP.

Do **not** rely on passkeys / WebAuthn for the first rollout; software TOTP is what the app implements today. SMS MFA via Cognito is planned after 10DLC / originator setup.

Terraform sets `cognito_mfa_configuration = "OPTIONAL"` and enables `software_token_mfa`. Some pool fields are ignored by Terraform lifecycle; if console and code diverge, use the Cognito sync script or console Edit.

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
| `mfa.enabled` | `false` | When `false`, no `mfaEnrollmentRequired`, no `/mfa/setup` redirect, Settings hides TOTP enrollment, and `POST /auth/mfa/setup` / `POST /auth/mfa/verify` return 403. |
| `mfa.method` | `"sms"` | Intended MFA method when the gate is turned on (`"sms"` or `"totp"`). SMS login/enroll is not implemented yet; this avoids a code change when SMS is ready. |

**Local / missing AppConfig:** backend treats MFA as **disabled** (same as `enabled: false`).

**Enable after SMS is live:** in the AppConfig console, edit the hosted configuration for the environment and set `"enabled": true`. Deploy immediately (Terraform uses an immediate deployment strategy). No app redeploy required.

Terraform creates per-environment AppConfig application + environment + `auth-features` profile. ECS backend receives `APPCONFIG_APPLICATION`, `APPCONFIG_ENVIRONMENT`, and `APPCONFIG_PROFILE`; the task role may call `appconfig:StartConfigurationSession` and `appconfig:GetLatestConfiguration`.

## App behavior

1. **Login challenge (already enrolled)** — If the user already has software MFA, Cognito returns `SOFTWARE_TOKEN_MFA`; client completes via `POST /auth/cognito/mfa`. Still works when `mfa.enabled` is `false`.
2. **Login challenge (MFA required, not enrolled)** — If the pool is **Require MFA** (`ON`) and the user has no TOTP, Cognito returns `MFA_SETUP` (no tokens). `POST /auth/cognito/login` associates a software token and returns a QR secret; the client finishes via `POST /auth/cognito/mfa/setup`. Blocked when AppConfig `mfa.enabled` is `false`.
3. **Enrollment after login (pool Optional)** — When AppConfig `mfa.enabled` is `true`, signed-in user calls `POST /auth/mfa/setup` → secret + `otpauth://` URI, then `POST /auth/mfa/verify` with a 6-digit code. Cognito `AssociateSoftwareToken` → `VerifySoftwareToken` → `SetUserMFAPreference`.
4. **Soft enrollment gate** — When AppConfig `mfa.enabled` is `true`, `/auth/me` and Cognito login responses include `mfaEnabled`, `mfaEnrollmentRequired`, and `mfaFeature: { enabled, method }`. Protected routes redirect to `/mfa/setup` until enrolled.
5. **Settings** — Security tab shows TOTP setup only when `mfaFeature.enabled` is true and the user is not yet enrolled. When off, copy explains SMS MFA is not required yet.

Unhandled Cognito challenges and SDK exceptions are mapped to user-facing copy. Server logs include the exception name and `ChallengeName` so new Cognito states are visible without reproducing from the UI.

## OAuth scope for enrollment

Hosted UI / Google access tokens must include `aws.cognito.signin.user.admin` or Cognito returns *Access Token does not have required scopes* on AssociateSoftwareToken / VerifySoftwareToken. Email/password (`USER_PASSWORD_AUTH`) tokens already include it.

Configured on the Cognito app client and requested in `buildCognitoAuthorizeUrl`. After changing scopes, users must **sign out and sign in again** so `Session.accessToken` is replaced — an old cookie keeps the previous token without the scope.

`/auth/me` MFA status uses AdminGetUser (IAM) and does not need that scope.

## When to enable MFA (AppConfig + Cognito)

1. Complete SMS originator / 10DLC and configure Cognito SMS MFA (out of scope for the AppConfig flag work).
2. Set AppConfig `mfa.enabled` to `true` and deploy the configuration.
3. Have admins enroll (TOTP today; SMS when implemented).
4. Optionally enroll HCPs (or communicate a deadline).
5. When ready for hard enforcement: Cognito console (or sync) → **MFA enforcement → Require MFA**.
6. Leave **dev** on Optional / AppConfig off if you want easy local/dev accounts.

## Related

- `infrastructure/terraform/modules/config/appconfig/` — AppConfig application, environment, `auth-features` profile
- `backend/src/feature-flags/feature-flags.service.ts` — AppConfig poller (~45s), in-memory cache
- `backend/src/auth/cognito.service.ts` — Associate / Verify / preference helpers; `MFA_SETUP` login
- `backend/src/auth/auth.controller.ts` — `/auth/cognito/login`, `/auth/cognito/mfa`, `/auth/cognito/mfa/setup`, `/auth/mfa/setup`, `/auth/mfa/verify`, `/auth/me`
- `frontend/src/pages/public/Login.tsx`, `MfaSetup.tsx`, `ProtectedRoute.tsx`, `Settings.tsx`
