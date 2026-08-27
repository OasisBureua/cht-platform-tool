# Zoom Cloud Recordings — Admin API & Program Hub

**Audience:** Sebastien, Syed, platform admins  
**Owner:** Platform  
**Related:** [integrations.md](./integrations.md), [chmbot-migration-architecture.md](./chmbot-migration-architecture.md)

**Canonical pipeline:** Zoom Cloud Recording API → **existing** `SESSION_ASSETS_S3_BUCKET` under prefix `zoom-recordings/` → Program Hub (presigned View/Download).

Do **not** create a separate recordings bucket. Do **not** treat Zoom `download_url` as durable storage.

---

## 1. Is there an endpoint for “all webinar recordings”?

**No single Zoom “webinars-only forever” endpoint.** Options:

| Zoom API | Use |
| -------- | --- |
| `GET /accounts/{accountId}/recordings` | Account-wide inventory (meetings + webinars). Max ~**1 month** per call — loop months. Scope: `cloud_recording:read:list_account_recordings:admin` |
| `GET /users/{userId}/recordings` | Per-host inventory (same date windows) |
| `GET /meetings/{meetingId}/recordings` | **One** webinar/meeting — what CHT Program Hub **Pull** uses |

For product use, drive pulls from **CHT programs** (`zoomMeetingId`) via the admin API below.

---

## 2. Scopes

### You already added

- `cloud_recording:read:recording:admin`
- Report scopes (`report:read:meeting:*`, `report:read:webinar:*`, participant list scopes)

### Add if Pull returns 403

| Scope | Why |
| ----- | --- |
| `cloud_recording:read:list_recording_files:admin` | File list + `download_url` for one meeting/webinar |
| `cloud_recording:read:list_user_recordings:admin` | Host inventory (scripts) |
| `cloud_recording:read:list_account_recordings:admin` | Account-wide inventory (scripts) |

Activate scopes → mint a **fresh** S2S token.

---

## 3. CHT admin endpoints (implemented)

Auth: admin session (`JwtAuthGuard` + `ADMIN`).

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/admin/programs/:id/recordings` | List recordings already in S3/DB for this program |
| `POST` | `/api/admin/programs/:id/recordings/pull` | Fetch from Zoom for `program.zoomMeetingId` (or body override) → stream to S3 → upsert rows |
| `GET` | `/api/admin/programs/:id/recordings/:recordingId/download-url` | Presigned S3 GET (~15 min) for View/Download |

### Pull body (optional)

```json
{ "zoomMeetingId": "81517150352" }
```

If omitted, uses `Program.zoomMeetingId`.

### Example (Sebastien / Syed)

```bash
# After logging in as admin and capturing session cookie / bearer as used by CHT
curl -s -X POST "$API/api/admin/programs/$PROGRAM_ID/recordings/pull" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

curl -s "$API/api/admin/programs/$PROGRAM_ID/recordings" \
  -H "Authorization: Bearer $TOKEN"

curl -s "$API/api/admin/programs/$PROGRAM_ID/recordings/$RECORDING_ID/download-url" \
  -H "Authorization: Bearer $TOKEN"
# → { "url": "https://s3…", "expiresInSeconds": 900, "recording": { … } }
```

### Config

| Env | Role |
| --- | ---- |
| `ZOOM_ACCOUNT_ID` / `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | S2S Zoom (existing) |
| `SESSION_ASSETS_S3_BUCKET` | **Existing** session-assets bucket (e.g. `cht-platform-session-assets`). Recordings use prefix `zoom-recordings/` only — no new bucket |
| AWS creds / task role | `s3:PutObject` + `s3:GetObject` on `{bucket}/zoom-recordings/*` (ECS task role; `session-heroes/*` is PutObject-only) |

S3 layout (same bucket as hero images):

```text
s3://{SESSION_ASSETS_S3_BUCKET}/session-heroes/…     ← public-read (existing)
s3://{SESSION_ASSETS_S3_BUCKET}/zoom-recordings/{programId}/{zoomMeetingId}/{fileId}.{ext}  ← private (presigned only)
```

Bucket policy already allows public `GetObject` only on `session-heroes/*`; `zoom-recordings/*` stays private.

### DB

Table `ProgramZoomRecording` (unique on `programId` + `zoomRecordingFileId`). Re-pull is idempotent.

---

## 4. Program Hub UI

On `/admin/programs/:programId/hub`:

- **Zoom recordings** section  
- **Pull from Zoom** (optional meeting id override)  
- List of stored files with **View** / **Download** (presigned)

HCPs never see this.

---

## 5. How you should work

1. Confirm Zoom scopes + cloud recording completed for a test webinar.  
2. Ensure S3 bucket env is set on the API.  
3. Open Program Hub → **Pull from Zoom** (or call `POST …/recordings/pull`).  
4. Use **View/Download** or `…/download-url` for QA.  
5. Optional bulk backfill: script Zoom account monthly list → for each id call CHT pull (or call Zoom download → S3 yourselves, then we can add an “register existing S3 object” later if needed).

**Participant reports** (attendance) remain separate Zoom Report APIs — not the same as MP4/transcript files.

---

## 6. Smoke-test checklist

- [ ] Scopes active; fresh token  
- [ ] `POST …/recordings/pull` succeeds for a known past webinar with cloud recording  
- [ ] `GET …/recordings` lists MP4/transcript rows  
- [ ] Presigned URL opens/downloads  
- [ ] Re-pull does not duplicate rows  

404 → recording not ready / wrong id. 403 from Zoom → missing `list_recording_files` scope. 503 → Zoom or S3 not configured.

---

## 7. Quick reference

| Goal | Action |
| ---- | ------ |
| One program’s files from Zoom → S3 | `POST /api/admin/programs/:id/recordings/pull` |
| List stored | `GET /api/admin/programs/:id/recordings` |
| Admin download/view | `GET …/recordings/:recordingId/download-url` |
| Account-wide Zoom inventory | Zoom `GET /accounts/{id}/recordings` (monthly loop) — not a CHT route yet |

**Zoom docs:** [Cloud Recording](https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#tag/Cloud-Recording) · [Reports](https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#tag/Reports)
