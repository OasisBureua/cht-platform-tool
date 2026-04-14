# GoTrue OAuth Redirect — Action Required (Sebastien)

**Issue:** After Google sign-in, users are redirected to MediaHub instead of the CHT platform (testapp.communityhealth.media).

**Cause:** GoTrue ignores our `redirect_to` parameter when the URL is not in its **Redirect URLs** allowlist.

**Fix:** Add this URL to GoTrue's Redirect URLs allowlist:

```
https://testapp.communityhealth.media/auth/callback
```

For local dev, also add:

```
http://localhost:5173/auth/callback
```

**Where to configure:** GoTrue admin / URL Configuration / Redirect URLs allowlist (or equivalent in your GoTrue setup).

**Our frontend** already sends the correct URL:
```
GET https://mediahub.communityhealth.media/auth/v1/authorize?provider=google&redirect_to=https://testapp.communityhealth.media/auth/callback?from=%2Fapp%2Fhome
```

Without the allowlist entry, GoTrue falls back to its default (MediaHub).
