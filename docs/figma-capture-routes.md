# Figma HTML→Design captures (route checklist)

Captured frames live in Figma file  
[CHM Platform: Screens & FRS Scope (`bud5cW5tvQyWNp6eZkWGMr`)](https://www.figma.com/design/bud5cW5tvQyWNp6eZkWGMr/).

See **`/.figma-capture-results.md`** at workspace root (`CHM`) for **path → `node-id` links** logged so far.

**Prereqs:** from `frontend/`, dev server with auth mocked off:

```bash
VITE_DISABLE_AUTH=true npm run dev -- --host 127.0.0.1 --port 5173
```

`frontend/index.html` must include [Figma `capture.js`](https://mcp.figma.com/mcp/html-to-design/capture.js) for local captures.

---

## Canonical route list (`App.tsx` screens; redirects omitted)

Paste into an agent prompt to continue **sequential** MCP captures (`generate_figma_design` → `browser_navigate` with `#figmacapture=…` → wait → poll until completed):

### Public (`PublicLayout`)

- `/home`
- `/about`
- `/services`
- `/portfolios`
- `/contact`
- `/join`
- `/login`
- `/admin/login`
- `/forgot-password`
- `/auth/callback`
- `/complete-profile`
- `/privacy`
- `/terms`
- `/search`
- `/catalog`
- `/catalog?view=playlists`
- `/catalog/breast-cancer` *(example disease slug)*
- `/catalog/clip/db11_neoadjuvant` *(example clip id)*
- `/catalog/playlist/her2-plus-conversations` *(playlist id may need API-real id from MediaHub/YT)*
- `/live`
- `/live/1`
- `/chm-office-hours`
- `/chm-office-hours/1`
- `/surveys`
- `/for-hcps`
- `/what-we-do`
- `/kol-network`
- `/kol-network/ny-northeast` *(example region slug)*
- `/kol-network/profile/traina` *(example KOL id; replace with `/kol-network/profile/:kolId`)*
- `/watch/db11_neoadjuvant` *(redirect → clip; capture final `/catalog/clip/…` with hash too if redirect strips hash)*

`/surveys/:id` (public compat) redirects to `/app/surveys/:id`: capture the `/app/surveys/:id` variant.

---

### Member app (`/app` + `Layout`)

- `/app/home`
- `/app/search`
- `/app/live`
- `/app/live/1`
- `/app/live/1/register`
- `/app/chm-office-hours`
- `/app/chm-office-hours/1`
- `/app/chm-office-hours/1/register`
- `/app/surveys`
- `/app/surveys/1`
- `/app/podcasts`
- `/app/catalog`
- `/app/catalog?view=playlists`
- `/app/catalog/breast-cancer`
- `/app/clip/db11_neoadjuvant`
- `/app/catalog/playlist/her2-plus-conversations`
- `/app/watch/db11_neoadjuvant`
- `/app/earnings`
- `/app/chatbot`
- `/app/settings`
- `/app/payments`

---

### Admin (`/admin` + `AdminLayout`)

Use `programId`/survey ids as needed for realism (placeholders okay for layout):

- `/admin`
- `/admin/programs`
- `/admin/programs/1/hub`
- `/admin/webinar-approvals`
- `/admin/office-hours`
- `/admin/surveys`
- `/admin/surveys/1/edit`
- `/admin/create-survey`
- `/admin/webinar-scheduler`
- `/admin/office-hours-scheduler`
- `/admin/payments`
- `/admin/settings`
- `/admin/hcp-explorer`
- `/admin/users`
- `/admin/rx-analytics`

---

## Known MCP limits

Very large DOM routes (often **`/kol-network`** hub listing all regions/KOL cards) may stay **`pending`** in Figma MCP. Retry with **`&figmaselector=`** narrowed to main content (`main`, `#root article`, …) or export a PNG from the browser and place in Figma manually.
