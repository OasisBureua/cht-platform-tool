# Integrations

Configuration for third-party services. Secrets are stored in AWS Secrets Manager in deployed environments and in `.env` locally.

## Authentication (Supabase / GoTrue)

Production auth is hosted on MediaHub (`https://mediahub.communityhealth.media`). The backend validates JWTs with `GOTRUE_JWT_SECRET` and stores sessions in Postgres (httpOnly cookies in production).

| Variable | Where |
|----------|-------|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Backend + frontend |
| `GOTRUE_JWT_SECRET` | Backend only |

**Redirect URLs:** Each environment domain must be in GoTrue's allowlist. Staging callback failures usually mean `https://staging.testapp.communityhealth.media/**` is missing.

**Local dev:** Set `VITE_USE_DEV_AUTH=true` to skip Supabase and use `X-Dev-User-Id` (see [getting-started.md](./getting-started.md)).

**Admin signup:** Admin users require the admin role in Postgres; signup flows may use a separate admin auth link or parameter — coordinate with MediaHub team.

## Zoom

Used for webinar/meeting creation, SDK embed, and attendance webhooks.

### Webhook

- **URL:** `https://<domain>/api/webhooks/zoom`
- **Secret:** `ZOOM_WEBHOOK_SECRET` (from Zoom Event Subscriptions)
- **Events:** `webinar.created`, `meeting.created`, `webinar.ended`, `meeting.ended`, `meeting.participant_joined`, `meeting.participant_left`

`webinar.created` / `meeting.created` auto-import DRAFT programs for admin review. Participant events link to programs by `zoomMeetingId`.

### API (Server-to-Server OAuth)

| Variable | Purpose |
|----------|---------|
| `ZOOM_ACCOUNT_ID` | Account ID |
| `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | OAuth app |
| `ZOOM_SDK_KEY`, `ZOOM_SDK_SECRET` | In-meeting SDK |

## JotForm

Post-event surveys and eligibility for honorariums.

### Webhook

- **URL:** `https://<domain>/api/webhooks/jotform`
- **Method:** POST (`multipart/form-data`, `rawRequest` JSON field)

Each `Survey` record needs `jotformFormId` set. Embedded forms must include a hidden `user_id` or `cht_user_id` field with the logged-in user's UUID.

### API

| Variable | Default |
|----------|---------|
| `JOTFORM_API_KEY` | Required |
| `JOTFORM_BASE_URL` | `https://api.jotform.com` (EU/Enterprise hosts differ) |

**Clone from template (admin):**

```
POST /api/admin/surveys/from-jotform-template
{ "programId": "...", "templateFormId": "260624911991966" }
```

The Webinar Scheduler can auto-clone the template when creating a program.

## Bill.com

Honorarium payouts via the Python payment worker.

| Variable | Purpose |
|----------|---------|
| `BILL_DEV_KEY` | API dev key |
| `BILL_USERNAME`, `BILL_PASSWORD` | Login |
| `BILL_ORG_ID`, `BILL_FUNDING_ACCOUNT_ID` | Org and funding account |

Bill.com sessions expire after ~35 minutes of inactivity; the worker re-authenticates as needed.

## MediaHub

Public content API for the video catalog.

| Variable | Purpose |
|----------|---------|
| `MEDIAHUB_BASE_URL` | API base (default: `https://mediahub.communityhealth.media/api/public`) |
| `MEDIAHUB_API_KEY` | API key |

## Email (Amazon SES)

Transactional email from the worker (`EMAIL_FROM`, typically `info@communityhealth.media`). Requires verified domain/identity in SES and IAM permissions on the worker task role.

## YouTube (catalog & podcasts)

- `YOUTUBE_API_KEY`
- `YOUTUBE_PLAYLIST_IDS` (comma-separated) — catalog playlists

Podcast show pages load episodes via `GET /api/podcasts/:showId/episodes?sort=latest|popular|oldest`. The server maps each show to its source channel (YouTube Data API v3 under the hood, using `YOUTUBE_API_KEY`).
