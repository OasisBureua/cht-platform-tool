# Auth Architecture Walkthrough

How the auth service, backend, Supabase (GoTrue), and the shared CHT auth endpoint all fit together.

---

## Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                                   │
│  Login page → AuthContext.login(email, password)                              │
│       → POST /api/auth/login { email, password }                              │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BACKEND (NestJS) - AuthController                         │
│  POST /api/auth/login                                                        │
│  1. Check: SUPABASE_URL + SUPABASE_ANON_KEY set?                             │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │ YES                      │                          │ NO
         ▼                          │                          ▼
┌─────────────────────┐              │              ┌─────────────────────────┐
│  SUPABASE PATH      │              │              │  DEV PATH               │
│  Call Supabase Auth │              │              │  AuthService.findByEmail│
│  POST {url}/auth/v1/│              │              │  (lookup in our DB)     │
│  token?grant_type=  │              │              │  password ignored       │
│  password           │              │              └───────────┬─────────────┘
└──────────┬──────────┘              │                          │
          │                          │                          │
          ▼                          │                          │
┌─────────────────────┐              │                          │
│  Supabase / GoTrue  │              │                          │
│  (mediahub.community│              │                          │
│  health.media)      │              │                          │
│  Validates email +  │              │                          │
│  password           │              │                          │
│  Returns: user id,  │              │                          │
│  access_token, etc. │              │                          │
└──────────┬──────────┘              │                          │
          │                          │                          │
          ▼                          │                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AuthService                                          │
│  findOrCreateByAuthId(authId)  OR  findByEmail(email)                        │
│  → Get/create user in our Prisma DB                                          │
│  → createSession(user) → store in Redis, return session_token                │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Response to frontend: { session_token, userId, email, name, role }           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND: Store session_token in localStorage                                │
│  All API calls: Authorization: Bearer <session_token>                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. The Supabase / GoTrue POST Endpoint (Sebastian’s shared CHT auth)

**What it is:** Supabase Auth (GoTrue) at `mediahub.communityhealth.media` - the shared CHT auth service (sometimes referred to as “Sebastian’s endpoint”).

**Endpoint:**
```
POST https://mediahub.communityhealth.media/auth/v1/token?grant_type=password
Headers: Content-Type: application/json, apikey: <SUPABASE_ANON_KEY>
Body: { "email": "...", "password": "..." }
```

**Behavior:**
- Validates email and password against Supabase Auth.
- On success: returns `{ user: { id, email, ... }, access_token, refresh_token }`.
- On failure: 4xx with `error_description` or `msg`.

**Config:** `SUPABASE_URL` and `SUPABASE_ANON_KEY` in backend `.env`.

---

## 2. Backend AuthController (`POST /api/auth/login`)

**Location:** `backend/src/auth/auth.controller.ts`

**Flow:**

1. Read `email` and `password` from the request body.
2. Branch on Supabase config:
   - **Supabase configured:** Call `POST {SUPABASE_URL}/auth/v1/token?grant_type=password` with email/password.
   - **Supabase not configured:** Call `AuthService.findByEmail(email)` (dev fallback).
3. **Supabase path:**
   - If Supabase returns 4xx → return error.
   - If 200 → get `authId = data.user.id`.
   - Call `AuthService.findOrCreateByAuthId(authId, email, firstName, lastName)`.
4. **Dev path:**
   - Use `AuthService.findByEmail(email)` to get user from your DB.
5. Call `AuthService.createSession(user)` → session stored in Redis.
6. Return `{ session_token, userId, email, name, role }` to the frontend.

---

## 3. AuthService

**Location:** `backend/src/auth/auth.service.ts`

**Main methods:**

| Method | Purpose |
|--------|---------|
| `findOrCreateByAuthId(authId, ...)` | Look up user by `authId` (Supabase user id). Create if missing. Cache in Redis. |
| `findByEmail(email)` | Dev fallback: look up user by email in Prisma DB. |
| `createSession(user)` | Create session in Redis, return UUID `session_token`. |
| `getSession(token)` | Load session from Redis by `session_token`. |
| `findByUserId(userId)` | Load user by DB id (used for `X-Dev-User-Id` in dev). |

**Redis usage:**
- `auth:user:{authId}` – user cache (30 min).
- `session:{token}` – session (30 min by default).

---

## 4. Protected Routes (JwtAuthGuard)

**Location:** `backend/src/auth/jwt-auth.guard.ts`

**Order of checks:**

1. **Session token:** `Authorization: Bearer <uuid>` or `X-Session-Token: <uuid>`.
   - If UUID → `AuthService.getSession(token)`.
   - If found → `request.user = user`, allow request.
2. **JWT (Supabase):** If `GOTRUE_JWT_SECRET` is set and Bearer is a JWT (not UUID).
   - Validate via GoTrueStrategy.
   - Resolve user via `findOrCreateByAuthId(authId)`.
3. **Dev bypass:** If no JWT secret → accept `X-Dev-User-Id` and use `findByUserId`.

---

## 5. Frontend AuthContext

**Location:** `frontend/src/contexts/AuthContext.tsx`

**Login flow:**
1. `login(email, password)` calls `POST ${VITE_API_URL}/auth/login` with `{ email, password }`.
2. On success: receives `{ session_token, userId, email, name, role }`.
3. Stores `session_token` in `localStorage` (`cht-session-token`).
4. `getAuthHeaders()` returns `{ Authorization: Bearer <session_token> }`.

**API client:**
- `api/client.ts` uses `authHeaderGetter` to add `Authorization: Bearer <session_token>` to every request.

---

## 6. Config Summary

| Config | Where | Purpose |
|--------|-------|---------|
| `SUPABASE_URL` | Backend `.env` | Supabase/GoTrue base URL (e.g. mediahub.communityhealth.media) |
| `SUPABASE_ANON_KEY` | Backend `.env` | Public anon key for token endpoint |
| `GOTRUE_JWT_SECRET` | Backend `.env` | Validates Supabase JWTs (optional when using session tokens) |
| `VITE_API_URL` | Frontend `.env` | Backend API base (e.g. http://localhost:3000/api) |

---

## 7. End-to-End Flow

**Login (Supabase configured):**
1. User submits email/password on login page.
2. Frontend → `POST /api/auth/login`.
3. Backend → Supabase `POST /auth/v1/token` with email/password.
4. Supabase validates → returns user + tokens.
5. Backend → `findOrCreateByAuthId(authId)` → your DB user.
6. Backend → `createSession(user)` → Redis.
7. Backend → returns `session_token` to frontend.
8. Frontend stores token and uses it for all API calls.

**Subsequent requests:**
1. Frontend sends `Authorization: Bearer <session_token>`.
2. JwtAuthGuard sees UUID → `getSession(token)`.
3. Redis returns user → `request.user` set → request allowed.

**Session expiry:**
- Session TTL (e.g. 30 min) set in Redis.
- When expired, Redis returns nothing → 401 → frontend redirects to login.
