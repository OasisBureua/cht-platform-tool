# Session lifetime policy

**Last updated:** July 2026

CHT sessions are opaque UUID cookies (`cht_session` / `X-Session-Token`) stored in Postgres and mirrored in Redis. Lifetime is dual-clock:

| Clock | Env var | Default | Behavior |
|-------|---------|---------|----------|
| **Idle** | `SESSION_TTL_SECONDS` | `1800` (30 min) | No authenticated activity → session ends. Activity **slides** idle expiry forward. |
| **Absolute** | `SESSION_ABSOLUTE_TTL_SECONDS` | `28800` (8 h) | Hard cap from `Session.createdAt`. Not extended by activity. |

## Why both

- **Idle alone** forces re-login after a coffee break but lets a stolen cookie live forever if the thief keeps using it.
- **Absolute alone** (fixed 30 min from login) logs out active users mid-work and does not distinguish “sitting idle” from “actively using the app.”
- **Idle + absolute** matches common web session practice: stay signed in while working (up to 8h), drop quickly when the tab is abandoned, and still force a fresh login by end of day even if the cookie was stolen and used continuously.

## Sliding renewal

`AuthService.resolveSession` (used by `JwtAuthGuard` on every authenticated request):

1. Reject if `now >= createdAt + absolute` **or** `now >= expiresAt` (idle).
2. If remaining idle time is **less than half** of `SESSION_TTL_SECONDS`, set  
   `expiresAt = min(now + idle, createdAt + absolute)` in Postgres + Redis.
3. Return `cookieMaxAgeSeconds` = remaining absolute time so the guard can refresh `Set-Cookie` Max-Age (browser cookie tracks absolute lifetime; idle is enforced server-side).

Half-window sliding avoids a Postgres write on every request while still renewing before idle expiry for active users.

## Cookie Max-Age

Login sets the cookie Max-Age to the **absolute** TTL (not idle). Using idle Max-Age would drop the browser cookie after 30 minutes of continuous use even when the server had slid the session.

## Defaults rationale

| Value | Rationale |
|-------|-----------|
| 30 min idle | PHI-adjacent healthcare product: abandoned desks should not stay authenticated for hours. |
| 8 h absolute | Covers a workday without overnight persistence of a stolen session cookie. |

Override via env / ECS task definition when product requirements change. Keep absolute ≥ idle.

## Compatibility / deploy

- Login / MFA / OAuth / cookie name / session token shape are unchanged.
- Existing sessions survive deploy: migration backfills `createdAt`; Redis entries without `createdAt` are dropped and rehydrated from Postgres.
- Idle default remains **30 minutes** (same as prior fixed TTL for abandoned sessions).
- Active users benefit from sliding (no longer forced out at 30 min of continuous use).
- **Apply the Prisma migration before or with the backend rollout** so `Session.createdAt` exists before the new code path runs.

## Related

- Implementation: `backend/src/auth/auth.service.ts` (`createSession`, `resolveSession`), `jwt-auth.guard.ts`, `session-cookie.ts`
- Schema: `Session.expiresAt` (idle), `Session.createdAt` (absolute anchor)
- Revocation (orthogonal): `docs/engineering/auth-session-revocation.md`
