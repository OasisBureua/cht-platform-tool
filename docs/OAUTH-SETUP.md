# Google / Apple OAuth Sign-In

CHT Platform supports Google and Apple sign-in via Supabase/GoTrue OAuth. **OAuth creates a CHT account and redirects to the platform** (`/app/home`), not to MediaHub.

## Flow

1. User clicks Google or Apple on **Login** or **Join**
2. Supabase/GoTrue handles OAuth with Google/Apple
3. **GoTrue redirects back to the CHT platform** (testapp.communityhealth.media/auth/callback)
4. CHT callback exchanges token with backend → creates/finds user → redirects to `/app/home`

## Backend

- **Endpoint:** `POST /api/auth/login-oauth`
- **Body:** `{ "access_token": "<GoTrue JWT>" }`
- **Returns:** Same shape as `POST /api/auth/login` (session_token, userId, email, etc.)

The backend validates the GoTrue JWT with `GOTRUE_JWT_SECRET` and creates a CHT user via `findOrCreateByAuthId`.

## Frontend

- **Login & Join pages:** Google and Apple buttons call `supabase.auth.signInWithOAuth({ provider })`
- **Redirect:** `redirectTo: ${origin}/auth/callback?from=/app/home` — always back to CHT platform
- **Callback:** Extracts token, calls `POST /api/auth/login-oauth`, stores session, navigates to `/app/home`

## GoTrue Configuration (Sebastien) — Critical

**OAuth must redirect to the CHT platform, NOT MediaHub.** The fix is to pass `redirect_to` when calling the authorize endpoint:

```
GET https://mediahub.communityhealth.media/auth/v1/authorize?provider=google&redirect_to=https://testapp.communityhealth.media/auth/callback
```

The frontend now builds this URL directly (see `buildOAuthAuthorizeUrl` in `lib/supabase.ts`).

Add these to GoTrue's **Redirect URLs** allowlist:

- `https://testapp.communityhealth.media/auth/callback`
- `http://localhost:5173/auth/callback` (dev)

If these URLs are missing, users will be sent to MediaHub instead of the CHT platform.

1. **Google OAuth**
   - Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Add authorized redirect URI: `https://mediahub.communityhealth.media/auth/v1/callback` (GoTrue callback)
   - Add Client ID and Client Secret to GoTrue

2. **Apple Sign-In**
   - Create a Sign in with Apple configuration in [Apple Developer](https://developer.apple.com/account/resources/identifiers/list/serviceId)
   - Configure Service ID, redirect URL, and keys
   - Add to GoTrue

3. **Redirect URLs (Site URL / Redirect allowlist)**
   - Add all CHT platform callback URLs above
   - Do NOT use MediaHub as the default redirect for CHT OAuth

## Environment

- `VITE_SUPABASE_URL` – GoTrue base URL (e.g. https://mediahub.communityhealth.media)
- `VITE_SUPABASE_ANON_KEY` – GoTrue anon key
- `VITE_APP_URL` – **Required for OAuth.** Your CHT platform base URL (e.g. https://testapp.communityhealth.media). OAuth uses this for `redirectTo` so users return to the CHT platform, not MediaHub. Must match an entry in GoTrue's Redirect URLs allowlist.
- `GOTRUE_JWT_SECRET` – Backend must have this to validate OAuth tokens
