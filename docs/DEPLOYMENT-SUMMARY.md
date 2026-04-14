# CHT Platform – Deployment Summary & Team Request

## Summary of Work Completed

### Catalog & Videos
- **Videos page (`/watch`)** – Now shows MediaHub clips with search, tags, doctor filter, sort, and infinite scroll (same behavior as catalog)
- **Catalog page (`/catalog`)** – Uses YouTube API to display playlists; "Play all" links to playlist detail
- **Playlist detail (`/catalog/playlist/:id`)** – In-app playback with embedded YouTube player, share buttons (Facebook, X, Reddit, Pinterest, Email), and Recommended Videos sidebar
- **Clip detail** – Share buttons added (Facebook, X, Reddit, Pinterest, Email)

### Homepage
- **Featured Videos** – Random selection from MediaHub clips (6 videos from a pool of 50)
- **Biomarker Playlists (HER2+)** – Populated from YouTube playlists whose titles match HER2/DESTINY-Breast
- **Biomarker Playlists (HR+)** – Populated from YouTube playlists (TNBC, HR+, or non-HER2 content)
- Cards link to real playlists with video names and "Play all" → playlist detail page

### Zoom API
- **Backend** – Zoom Server-to-Server OAuth integration for webinars
- **Endpoints** – `GET /api/webinars` and `GET /api/webinars/:id` merge Zoom webinars with DB programs
- **Features** – Pagination, single-webinar fetch, token caching, startup logging
- **Status** – Code ready; needs credentials from team

### Infrastructure & Deployment
- **Version** – Bumped to v1.0.8
- **CloudFront** – Fixed `InvalidGeoRestrictionParameter` by adding explicit `locations = []` to geo restriction block
- **Deployment** – Build → Push to ECR → Terraform apply → Deploy frontend

### What’s Live
- **MediaHub** – Catalog clips, tags, doctors, search
- **YouTube** – Playlists for Catalog and homepage biomarker sections
- **Supabase** – Auth
- **Domain** – testapp.communityhealth.media

---

## Email Template: What We Need From the Team

---

**Subject:** CHT Platform – Credentials & Info Needed to Complete Features

Hi team,

We’ve deployed the latest CHT Platform updates to **testapp.communityhealth.media** (v1.0.8). Several features are in place but need credentials or configuration from you to go live.

---

### 1. Zoom (Webinars) – High priority

The webinars pages (`/webinars`, `/webinars/:id`) are wired to the Zoom API. To show live scheduled webinars, we need a **Server-to-Server OAuth** app.

**Steps for whoever manages Zoom:**
1. Go to [Zoom App Marketplace](https://marketplace.zoom.us/) → **Develop** → **Build App**
2. Choose **Server-to-Server OAuth**
3. Add scope: `webinar:read:admin` (or `webinar:read`)
4. Activate the app and copy: **Account ID**, **Client ID**, **Client Secret**

**Please share these securely** (e.g. 1Password, encrypted channel):
- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`

Without these, the platform falls back to database programs only; Zoom webinars will not appear.

---

### 2. Bill.com (HCP Payouts) – Optional

We have the Bill.com developer key. To enable ACH/check payouts for HCPs, we still need:

- Bill.com account **username** (email)
- Bill.com account **password**
- **Organization ID** (from Bill.com Settings)
- **Funding account ID** (for ACH/check disbursements)

These can be shared via a secure channel when you’re ready to enable payments.

---

### 3. Other Items (as needed)

- **GOTRUE_JWT_SECRET** – If we need to validate JWTs from MediaHub auth
- **Content / copy** – Homepage “Content Title” section and other placeholder text
- **Zoom webinar ownership** – Webinars are pulled for the account user; if webinars are created by multiple users, we may need to adjust how we list them

---

### What’s working now

- MediaHub catalog (clips, search, tags, doctors)
- YouTube playlists (Catalog + homepage biomarker sections)
- Supabase auth (login/signup)
- Featured videos, biomarker playlists (HER2+, HR+)
- Share buttons (Facebook, X, Reddit, Pinterest, Email)
- In-app playlist playback

---

### How to reach me

[Your contact info]

Thanks,  
[Your name]
