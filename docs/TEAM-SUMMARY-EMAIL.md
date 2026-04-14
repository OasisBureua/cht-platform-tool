# Team Summary: CHT Platform Integration Updates

**Subject:** CHT Platform – Integration Update – Action Items Needed

---

Hi team,

We've finished integrating the YouTube API for the catalog and the Zoom API for webinars. **Login with authentication is working now.** Here's what's done and what we need from you.

---

## What's Done

- **Auth:** Login/signup with authentication is working.
- **Catalog:** YouTube Data API v3 for catalog content (playlists); falls back to DB programs if not configured.
- **Webinars:** Zoom API + DB programs. Public webinar pages show login prompt when not logged in.
- **Pages:** Catalog, Webinars, For HCPs (public + in-app) use live API data.

---

## What We Need From You

**1. Supabase link (priority)**  
We need the Supabase auth URL to test the full flow end-to-end (login, catalog, webinars).

**2. YouTube**  
- Confirm API key is correct.  
- Comma-separated playlist IDs (from URLs like `https://www.youtube.com/playlist?list=PLxxx`).

**3. Zoom**  
Create a Server-to-Server OAuth app at [marketplace.zoom.us](https://marketplace.zoom.us/) and share via secure channel:
- Account ID, Client ID, Client Secret  
- Scopes: at least `webinar:read`

**4. Env vars** (backend): `YOUTUBE_API_KEY`, `YOUTUBE_PLAYLIST_IDS`, `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`

---

## Next Steps

1. Share Supabase link for testing.  
2. Confirm YouTube key + playlist IDs.  
3. Create Zoom app and share credentials.  
4. QA catalog and webinar flows.

Thanks,  
[Your name]
