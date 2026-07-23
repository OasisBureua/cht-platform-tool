# Cognito MFA (authenticator apps)

**Last updated:** July 2026

## Pool settings (console)

| Environment | User pool | MFA enforcement | Methods |
|-------------|-----------|-----------------|---------|
| **dev** (`devapp`) | `cht-dev-users` | **Optional MFA** | Authenticator apps |
| **platform** (`testapp`) | platform pool | **Optional MFA** for now | Authenticator apps |

Keep platform on **Optional** until enrollment works for existing users. Flip to **Require MFA** only after admins (then all users) have enrolled — otherwise Cognito blocks sign-in for users without TOTP.

Do **not** rely on passkeys / WebAuthn for the first rollout; software TOTP is what the app implements.

Terraform sets `cognito_mfa_configuration = "OPTIONAL"` and enables `software_token_mfa`. Some pool fields are ignored by Terraform lifecycle; if console and code diverge, use the Cognito sync script or console Edit.

## App behavior

1. **Login challenge** — If the user already has software MFA, Cognito returns `SOFTWARE_TOKEN_MFA`; client completes via `POST /auth/cognito/mfa`.
2. **Enrollment** — Signed-in user calls `POST /auth/mfa/setup` → secret + `otpauth://` URI, then `POST /auth/mfa/verify` with a 6-digit code. Cognito `AssociateSoftwareToken` → `VerifySoftwareToken` → `SetUserMFAPreference`.
3. **Soft admin gate** — While the pool is Optional, `/auth/me` and Cognito login responses include `mfaEnabled` and `mfaEnrollmentRequired` (`true` for `ADMIN` without MFA). Admin routes redirect to `/mfa/setup` until enrolled.
4. **Settings** — Security tab links to `/mfa/setup` when MFA is not yet enabled.

## When to set Require MFA on platform

1. Deploy enrollment APIs + admin gate.
2. Have all platform admins complete `/mfa/setup`.
3. Optionally enroll HCPs (or communicate a deadline).
4. In Cognito console (or sync): **MFA enforcement → Require MFA**.
5. Leave **dev** on Optional so local/dev accounts stay easy to use.

## Related

- `backend/src/auth/cognito.service.ts` — Associate / Verify / preference helpers
- `backend/src/auth/auth.controller.ts` — `/auth/mfa/setup`, `/auth/mfa/verify`, `/auth/me`
- `frontend/src/pages/public/MfaSetup.tsx`, `ProtectedRoute.tsx`
