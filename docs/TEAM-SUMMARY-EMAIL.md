# Team Summary: CHT Platform Integration Updates

**Subject:** CHT Platform – YouTube & Zoom Integration Complete – Action Items Needed

---

Hi team,

We’ve finished integrating the YouTube API for the catalog and the Zoom API for webinars on the CHT platform. Here’s what’s in place and what we need from you.

---

## What’s Done

### 1. YouTube API – Catalog Page
- The catalog page now pulls content from the **YouTube Data API v3** instead of placeholder images.
- When configured, it shows playlists from your YouTube channel(s).
- If YouTube isn’t configured, it falls back to programs in the database.

### 2. Zoom API – Webinars
- Webinars are sourced from the **Zoom API** (scheduled webinars) plus existing programs in the database.
- Public webinar pages (`/webinars/:id`) show a **login/sign-up prompt** when the user isn’t logged in.
- Logged-in users can register for programs or join Zoom webinars directly.

### 3. Pages Updated
- **Public:** Catalog, Webinars, For HCPs – all use live API data.
- **In-app:** Webinars page – uses the same APIs.
- **Detail flows:** Public webinar detail with login prompt; app webinar detail with enrollment/join.

---

## What We Need From You

### 1. YouTube API
- **YouTube API key** – we already have one in use; please confirm it’s tied to the correct Google Cloud project.
- **YouTube playlist IDs** – comma-separated IDs for the playlists you want on the catalog.  
  These come from URLs like: `https://www.youtube.com/playlist?list=PLxxxxxxxxxx`  
  → Playlist ID: `PLxxxxxxxxxx`

### 2. Zoom API (Server-to-Server OAuth)
Create a Server-to-Server OAuth app in the [Zoom Marketplace](https://marketplace.zoom.us/):

1. **Account ID** – from your Zoom developer account.
2. **Client ID** – from the OAuth app.
3. **Client Secret** – from the OAuth app.
4. **Scopes** – ensure the app has at least `webinar:read` (and any others needed for listing webinars).

Please share these via a secure channel (e.g. secrets manager, 1Password, or Slack DM to the dev lead). Do **not** commit them to the repo.

### 3. Environment Variables
These need to be set in the backend environment (e.g. `.env` or deployment config):

| Variable | Required? | Notes |
|----------|-----------|--------|
| `YOUTUBE_API_KEY` | Yes (for catalog) | Google Cloud API key |
| `YOUTUBE_PLAYLIST_IDS` | Yes (for catalog) | Comma-separated playlist IDs |
| `ZOOM_ACCOUNT_ID` | Yes (for Zoom webinars) | Zoom developer account ID |
| `ZOOM_CLIENT_ID` | Yes (for Zoom webinars) | Zoom OAuth app client ID |
| `ZOOM_CLIENT_SECRET` | Yes (for Zoom webinars) | Zoom OAuth app client secret |

---

## User Flow Summary

**Public visitor**
1. Browses catalog or webinars.
2. Clicks a webinar → sees detail page with “Sign in” / “Create account”.
3. After auth → redirected to enrollment or join flow.

**Logged-in user**
1. Sees catalog and webinars from the APIs.
2. Clicks webinar → goes to detail page with “Register” or “Join Webinar”.
3. Program webinars: enrollment flow; Zoom webinars: direct join link.

---

## Next Steps

1. Confirm YouTube API key and playlist IDs.
2. Create Zoom Server-to-Server OAuth app and share credentials.
3. Add the env vars to staging/production.
4. QA the catalog and webinar flows on staging.

If anything is unclear or you need help with Zoom/YouTube setup, let me know.

Thanks,  
[Your name]
