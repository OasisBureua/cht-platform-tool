# Auth: Confirmation Email Not Sending

## Issue

When users sign up via the Join page (or `POST /auth/v1/signup`), GoTrue returns:

```json
{"code":500,"msg":"Error sending confirmation mail","error_id":"..."}
```

The user may or may not be created in the database, but the confirmation email never arrives. Users cannot log in until they verify their email.

---

## Root Cause

The email configuration on the GoTrue auth server (mediahub.communityhealth.media) is failing. This is configured on the auth server side, not in CHT Platform.

---

## What Needs to Be Fixed (Auth Server / Sebastian)

The GoTrue instance needs correct SMTP/email configuration. Common causes:

### 1. SMTP not configured or misconfigured
- GoTrue uses `GOTRUE_SMTP_*` environment variables
- Ensure `GOTRUE_SMTP_HOST`, `GOTRUE_SMTP_PORT`, `GOTRUE_SMTP_USER`, `GOTRUE_SMTP_PASS` are set
- For Gmail: use App Password, not regular password; enable "Less secure app access" or use OAuth

### 2. Sender address (sfregeau56@gmail.com)
- The sender domain/address may need to be verified
- Gmail may block sends from unverified or "less secure" contexts
- Consider using a transactional email service (SendGrid, Postmark, AWS SES) for production

### 3. GoTrue config
- `GOTRUE_MAILER_AUTOCONFIRM` – if set to `true`, users can log in without email confirmation (useful for testing)
- `GOTRUE_SMTP_ADMIN_EMAIL` – sender address
- Check GoTrue logs on the EC2/Docker container for the actual error

### 4. Quick test fix (development only)
- Set `GOTRUE_MAILER_AUTOCONFIRM=true` so new users can log in immediately without email verification
- This bypasses the email send entirely for testing

---

## Temporary Workaround

Until email is fixed, Sebastian can **manually confirm users** in the auth database:

```sql
-- In the auth.users table (or equivalent GoTrue schema)
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email = 'user@example.com';
```

Or use the GoTrue Admin API if available.

---

## CHT Platform Side

- Signup and login are proxied through our backend (no CORS issues)
- When we receive "Error sending confirmation mail", we treat it as success so the user sees "Check your email"
- The actual fix must happen on the auth server configuration
