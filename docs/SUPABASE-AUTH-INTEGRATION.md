# Supabase / GoTrue Auth Integration

CHT Platform uses the shared authentication system at **mediahub.communityhealth.media/auth/v1** (GoTrue).

## Frontend

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SUPABASE_URL` | `https://mediahub.communityhealth.media` | GoTrue base URL (client appends `/auth/v1`) |
| `VITE_SUPABASE_ANON_KEY` | `public` | No API key needed for self-hosted GoTrue |
| `VITE_USE_DEV_AUTH` | `false` | Set to `true` for local dev with X-Dev-User-Id bypass |

### Features

- **Login**: Email + password via `signInWithPassword`
- **Signup**: Email + password + optional full name, profession via `signUp`
- **Password reset**: `resetPasswordForEmail`
- **Session**: Access token sent as `Authorization: Bearer <token>` to backend

### Dev mode

Set `VITE_USE_DEV_AUTH=true` to use the dev bypass (X-Dev-User-Id header) instead of Supabase. Requires backend with `npx prisma db seed` and `VITE_DEV_USER_ID`.

## Backend

### Configuration

| Variable | Description |
|----------|-------------|
| `GOTRUE_JWT_SECRET` | JWT secret for validating tokens from GoTrue. **Get from MediaHub/CHM team.** |

When `GOTRUE_JWT_SECRET` is set (and `AUTH0_DOMAIN` is not), the backend validates JWTs using HS256 and maps `sub` to the User table via `findOrCreateByAuthId`.

### Auth order

1. **Auth0** – if `AUTH0_DOMAIN` is set
2. **GoTrue** – if `GOTRUE_JWT_SECRET` is set
3. **Dev bypass** – if neither; accepts `X-Dev-User-Id` header

## Current limitations (from MediaHub)

- Email verification required before first login
- Google/Apple OAuth not enabled yet
- Emails sent from temporary address until domain verification

## Redirect URLs

Vercel domain is whitelisted: `https://cht-platform-tool-demo.vercel.app`. Contact MediaHub to add new domains.
