# Admin Auth – Request for Sebastian (MediaHub/GoTrue)

## Summary

CHT Platform has a dedicated **admin login page** at `/admin/login`. Admins sign in with the same GoTrue credentials as HCPs, but we distinguish them by the `role` field in our database (set via admin promotion or DB update).

We need one of the following from Sebastian to support a cleaner admin auth flow:

---

## Option A: Separate Admin Supabase/GoTrue Link

Create a separate auth instance or app configuration for admins, e.g.:

- **HCP/KOL:** `https://mediahub.communityhealth.media/auth/v1` (existing)
- **Admin:** `https://admin.mediahub.communityhealth.media/auth/v1` (or similar)

Admins would use a different signup/login URL. CHT would know the user is an admin based on which auth endpoint they used.

---

## Option B: Add Parameter to POST /auth/v1/signup and /auth/v1/token

Add an optional parameter to distinguish admin signup/login:

**Signup:**
```
POST /auth/v1/signup
Body: { email, password, data: { ..., role: "ADMIN" } }
```

**Login (token):**
```
POST /auth/v1/token?grant_type=password
Body: { email, password, admin: true }  // or role: "ADMIN"
```

When `admin: true` or `role: "ADMIN"` is present, GoTrue could:
- Validate against an admin-only user pool, or
- Include `role: "ADMIN"` in the JWT `user_metadata` so CHT can set the DB role on first login

---

## Current CHT Flow (No Changes Needed on GoTrue)

Until Sebastian implements one of the above:

1. **Admin creation:** An existing admin promotes a user via Admin → Users → change role to Admin, OR we run a DB update.
2. **Admin login:** Admin goes to `/admin/login`, enters same email/password as HCP login. CHT looks up the user in our DB; if `role === 'ADMIN'`, we allow access to `/admin`.
3. **First admin:** Use ECS execute-command to run `UPDATE "User" SET role = 'ADMIN' WHERE email = '...'` in production.

---

## Contact

Questions: CHT Platform team.
