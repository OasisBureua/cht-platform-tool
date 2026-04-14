# Auth Verification Checklist

## Current Auth Flow

### Backend (auth.controller.ts)
- **POST /api/auth/login** – Accepts `{ email, password }`
- **Supabase path**: When `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in backend `.env`, validates against Supabase Auth API.
- **Dev path**: When Supabase not configured, looks up user by email in DB (password ignored). Use seeded users: `dev@chtplatform.local`, `admin@chtplatform.local`.

### Frontend (AuthContext.tsx)
- Calls `POST ${VITE_API_URL}/auth/login` with email/password.
- Stores `session_token` in localStorage.
- Sends `Authorization: Bearer <session_token>` on API requests.
- Fetches `/auth/me` to load user profile.

### Connection
- Frontend `VITE_API_URL` → Backend (e.g. `http://localhost:3000/api`).
- API client (`api/client.ts`) uses `authHeaderGetter` to add Bearer token to requests.

---

## Verification Checklist

### 1. Backend .env (for Supabase)
```env
SUPABASE_URL=https://mediahub.communityhealth.media
SUPABASE_ANON_KEY=your_anon_key
GOTRUE_JWT_SECRET=your_jwt_secret   # For validating Supabase JWTs on /auth/me
```

### 2. Backend .env (for Dev – no Supabase)
Leave `SUPABASE_URL` and `SUPABASE_ANON_KEY` empty. Run:
```bash
cd backend && npx prisma db seed
```

### 3. Frontend .env
```env
VITE_API_URL=http://localhost:3000/api
```

### 4. Backend Logs (when login is attempted)
- **Supabase path**: `[Auth] Login attempt via Supabase for email: ...` → `[Auth] Supabase login success: userId=...`
- **Dev path**: `[Auth] Login attempt via dev fallback (DB) for email: ...` → `[Auth] Dev login success: userId=...`
- **/auth/me**: `[Auth] /me OK: userId=... email=...` (debug level)

### 5. Test Commands
```bash
# Health check
curl http://localhost:3000/health/ready

# Login (dev)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@chtplatform.local","password":"any"}'

# Use returned session_token for /auth/me
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <session_token>"
```

---

## Summary

| Component | Supabase configured? | Behavior |
|-----------|-----------------------|----------|
| Backend login | Yes | Validates email/password via Supabase Auth API |
| Backend login | No | Looks up user by email in DB (password ignored) |
| Session | Always | Stored in Redis, TTL 30 min |
| Frontend | Always | Calls backend /auth/login, no direct Supabase |
