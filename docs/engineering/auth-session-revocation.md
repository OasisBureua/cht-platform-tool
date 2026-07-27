# Auth session revocation

**Last updated:** July 2026

CHT issues **Postgres sessions** (httpOnly cookie / `X-Session-Token`) after Cognito (or legacy) login. Each session may also be mirrored in Redis as `cht:session:{token}` for faster `getSession` lookups.

## Two different helpers

| Method | Postgres | Redis | When to use |
|--------|----------|-------|-------------|
| `invalidateAuthCache(userId)` | **Keeps** rows | Deletes keys | Stale cached fields only (e.g. after `setUserRole`). Next `getSession` rehydrates from Postgres. |
| `revokeAllUserSessions(userId)` | **Deletes** all rows for user | Deletes keys | Password reset / password change — stolen cookies must stop working. |
| `revokeSession(token)` | Deletes one row | Deletes one key | Logout |

**Do not** call `invalidateAuthCache` after a password event. Redis-only invalidation leaves Session rows in Postgres, so the next request can recreate the Redis entry and stay authenticated.

## Triggers

1. **`POST /api/auth/recover/confirm`** — after successful Cognito `ConfirmForgotPassword`, look up the CHT user by email and call `revokeAllUserSessions`.
2. **`POST /api/auth/cognito/change-password`** — authenticated user supplies `oldPassword` / `newPassword`. Backend uses the Cognito **access token** stored on the current session, calls Cognito `ChangePassword`, then `revokeAllUserSessions` and clears the session cookie. Client must sign in again.

## Session cookie vs Cognito refresh tokens

Login / MFA / OAuth callback responses intentionally **do not** return Cognito (or GoTrue) `refresh_token` in the JSON body. Auth is the Postgres httpOnly session cookie (`session_token` / `cht_session`). If a server-side refresh flow is needed later, store and rotate the refresh token only on the server — never ship it to the browser.

## Expected client behavior

After reset or change-password, other tabs/devices receive **401** on the next API call and should redirect to login. That is intentional.

## Related

- Session model: `backend/prisma/schema.prisma` (`Session`)
- Lifetime (idle + absolute): `docs/engineering/session-lifetime.md`
- Implementation: `backend/src/auth/auth.service.ts`, `auth.controller.ts`, `cognito.service.ts`
- Catalog cache clear does **not** touch sessions (`docs/runbooks/cache-sync-contract.md`)
