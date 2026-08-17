# Cognito MFA (authenticator apps)

**Last updated:** August 2026

## Pool settings (console)

| Environment | User pool | MFA enforcement | Methods |
|-------------|-----------|-----------------|---------|
| **dev** (`devapp`) | `cht-dev-users` | **Optional MFA** | Authenticator apps |
| **platform** (`testapp`) | platform pool | **Optional MFA** for now | Authenticator apps |

Keep platform on **Optional** until enrollment works for existing users. Flip to **Require MFA** only after admins (then all users) have enrolled — otherwise Cognito blocks sign-in for users without TOTP.

Do **not** rely on passkeys / WebAuthn for the first rollout; software TOTP is what the app implements.

Terraform sets `cognito_mfa_configuration = "OPTIONAL"` and enables `software_token_mfa`. Some pool fields are ignored by Terraform lifecycle; if console and code diverge, use the Cognito sync script or console Edit.

## App behavior

1. **Login challenge (already enrolled)** — If the user already has software MFA, Cognito returns `SOFTWARE_TOKEN_MFA`; client completes via `POST /auth/cognito/mfa`.
2. **Login challenge (MFA required, not enrolled)** — If the pool is **Require MFA** (`ON`) and the user has no TOTP, Cognito returns `MFA_SETUP` (no tokens). `POST /auth/cognito/login` associates a software token and returns a QR secret; the client finishes via `POST /auth/cognito/mfa/setup`. Do not use signed-in `POST /auth/mfa/setup` for this path — that endpoint needs an access token that does not exist yet.
3. **Enrollment after login (pool Optional)** — Signed-in user calls `POST /auth/mfa/setup` → secret + `otpauth://` URI, then `POST /auth/mfa/verify` with a 6-digit code. Cognito `AssociateSoftwareToken` → `VerifySoftwareToken` → `SetUserMFAPreference`.
4. **Soft admin gate** — While the pool is Optional, `/auth/me` and Cognito login responses include `mfaEnabled` and `mfaEnrollmentRequired`. Protected routes redirect to `/mfa/setup` until enrolled.
5. **Settings** — Security tab links to `/mfa/setup` when MFA is not yet enabled.

Unhandled Cognito challenges and SDK exceptions are mapped to user-facing copy. Server logs include the exception name and `ChallengeName` so new Cognito states are visible without reproducing from the UI.

## OAuth scope for enrollment

Hosted UI / Google access tokens must include `aws.cognito.signin.user.admin` or Cognito returns *Access Token does not have required scopes* on AssociateSoftwareToken / VerifySoftwareToken. Email/password (`USER_PASSWORD_AUTH`) tokens already include it.

Configured on the Cognito app client and requested in `buildCognitoAuthorizeUrl`. After changing scopes, users must **sign out and sign in again** so `Session.accessToken` is replaced — an old cookie keeps the previous token without the scope.

`/auth/me` MFA status uses AdminGetUser (IAM) and does not need that scope.

## When to set Require MFA on platform

1. Deploy enrollment APIs + admin gate.
2. Have all platform admins complete `/mfa/setup`.
3. Optionally enroll HCPs (or communicate a deadline).
4. In Cognito console (or sync): **MFA enforcement → Require MFA**.
5. Leave **dev** on Optional so local/dev accounts stay easy to use.

## Related

- `backend/src/auth/cognito.service.ts` — Associate / Verify / preference helpers; `MFA_SETUP` login
- `backend/src/auth/auth.controller.ts` — `/auth/cognito/login`, `/auth/cognito/mfa`, `/auth/cognito/mfa/setup`, `/auth/mfa/setup`, `/auth/mfa/verify`, `/auth/me`
- `frontend/src/pages/public/Login.tsx`, `MfaSetup.tsx`, `ProtectedRoute.tsx`
