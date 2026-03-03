# CHT Platform – Credentials & Configuration Needed

**To:** Team  
**Re:** Outstanding credentials to complete survey, webinar, and platform configuration

---

## Summary

We need a few credentials and configurations to finish survey and webinar setup. **All auth and MediaHub questions should go to Sebastian.**

---

## 1. Auth & MediaHub → Sebastian

**Contact:** Sebastian

- **GoTrue/Supabase:** `supabase_anon_key`, `gotrue_jwt_secret` for testapp.communityhealth.media
- **MediaHub Public API:** `mediahub_api_key` for catalog (clips, tags, doctors, search)
- **Admin auth:** Separate admin Supabase link or POST parameter for admin signup (see `docs/ADMIN-AUTH-SEBASTIAN.md`)
- **Google/Apple OAuth:** Enable in MediaHub/GoTrue for sign-in (see `docs/OAUTH-SETUP.md`)
- **Debug endpoint:** `GET https://mediahub.communityhealth.media/api/public/debug/recent-errors` for troubleshooting

---

## 2. Zoom API Credentials (Webinars)

**Needed to finish webinar configuration.**

| Credential | Where to get |
|------------|---------------|
| `zoom_account_id` | Zoom Marketplace app |
| `zoom_client_id` | Zoom Marketplace app |
| `zoom_client_secret` | Zoom Marketplace app |

**Setup:** Create a Server-to-Server OAuth app at [marketplace.zoom.us](https://marketplace.zoom.us).  
**Scopes:** `webinar:read:admin`, `webinar:read`

Add to `platform.tfvars` (or Secrets Manager) for testapp.communityhealth.media.

---

## 3. HubSpot API Credentials (Surveys / Email)

**Needed to finish survey and email configuration.**

| Credential | Where to get |
|------------|---------------|
| `hubspot_smtp_user` | HubSpot → Settings → Integrations → Email |
| `hubspot_smtp_password` | HubSpot → Settings → Integrations → Email |

Used for survey notifications and transactional email. Add to Secrets Manager or `platform.tfvars`.

---

## 4. Bill.com (Already Configured)

Bill.com connection is working locally. For production (testapp.communityhealth.media):

- Add `bill_dev_key`, `bill_username`, `bill_password`, `bill_org_id`, `bill_funding_account_id` to `platform.tfvars` (or Secrets Manager).
- **Production URL:** The backend uses `https://gateway.prod.bill.com/connect/v3` when `NODE_ENV=production`. No extra config needed.
- **Funding account ID:** Seth to obtain from Bill.com (Settings → Bank & Payment Accounts) for Pay now.

---

## 5. Platform.tfvars Checklist

| Variable | Status | Notes |
|----------|--------|-------|
| `supabase_anon_key` | Sebastian | GoTrue anon key |
| `gotrue_jwt_secret` | Sebastian | JWT validation |
| `mediahub_api_key` | Sebastian | MediaHub Public API |
| `bill_dev_key` | ✓ | Add to platform.tfvars |
| `bill_username` | ✓ | Add to platform.tfvars |
| `bill_password` | ✓ | Add to platform.tfvars |
| `bill_org_id` | ✓ | Add to platform.tfvars |
| `bill_funding_account_id` | Seth | For Pay now |
| `zoom_account_id` | **NEEDED** | Webinars |
| `zoom_client_id` | **NEEDED** | Webinars |
| `zoom_client_secret` | **NEEDED** | Webinars |
| HubSpot SMTP | **NEEDED** | Surveys / email |

---

## Next Steps

1. **Sebastian:** Auth, MediaHub, OAuth, admin auth
2. **Team:** Zoom credentials for webinars
3. **Team:** HubSpot SMTP for surveys/email
4. **Seth:** Bill.com funding account ID for Pay now

---

*platform.tfvars is gitignored. Copy from `platform.tfvars.example` and fill in values.*
