# Auth email enumeration

**Last updated:** July 2026

Signup and password recovery must not tell a caller whether an email is already registered.

| Endpoint | Behavior |
|----------|----------|
| `POST /auth/cognito/signup` | `UsernameExistsException` → same success shape as a new signup (`userConfirmed: false`); may attempt `ResendConfirmationCode` for unconfirmed users (errors swallowed). |
| `POST /auth/signup` (legacy) | GoTrue “already registered” style errors → `{}` success. |
| `POST /auth/recover` (Cognito) | Success or Cognito miss → `{}`; lockout still returns an error. |
| Join / Forgot Password UI | Generic “If … exists / can be registered …” copy. |

Validation errors (bad password, missing fields, captcha, lockout) still return specific messages — those do not reveal account existence.
