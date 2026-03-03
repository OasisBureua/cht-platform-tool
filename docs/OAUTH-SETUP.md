# Google / Apple OAuth Sign-In

CHT Platform supports Google and Apple sign-in via Supabase/GoTrue OAuth.

## Backend

- **Endpoint:** `POST /api/auth/login-oauth`
- **Body:** `{ "access_token": "<GoTrue JWT>" }`
- **Returns:** Same shape as `POST /api/auth/login` (session_token, userId, email, etc.)

The backend validates the GoTrue JWT with `GOTRUE_JWT_SECRET` and creates a CHT session.

## Frontend

- **Login page:** Google and Apple buttons call `supabase.auth.signInWithOAuth({ provider })`
- **Redirect:** Supabase redirects to `/auth/callback` with `access_token` in the URL hash
- **Callback:** Extracts token, calls `POST /api/auth/login-oauth`, stores session, redirects to app

## MediaHub / GoTrue Configuration (Sebastian)

For OAuth to work, the following must be configured in the MediaHub/GoTrue dashboard:

1. **Google OAuth**
   - Create OAuth 2.0 credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Add authorized redirect URI: `https://mediahub.communityhealth.media/auth/v1/callback` (or your GoTrue callback URL)
   - Add Client ID and Client Secret to GoTrue

2. **Apple Sign-In**
   - Create a Sign in with Apple configuration in [Apple Developer](https://developer.apple.com/account/resources/identifiers/list/serviceId)
   - Configure Service ID, redirect URL, and keys
   - Add to GoTrue

3. **Redirect URLs**
   - Add `https://testapp.communityhealth.media/auth/callback` (and localhost for dev) to allowed redirect URLs in GoTrue

## Environment

- `VITE_SUPABASE_URL` – GoTrue base URL (e.g. https://mediahub.communityhealth.media)
- `VITE_SUPABASE_ANON_KEY` – GoTrue anon key
- `GOTRUE_JWT_SECRET` – Backend must have this to validate OAuth tokens
