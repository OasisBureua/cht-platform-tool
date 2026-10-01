# Reports generate API + transcript export (cht-platform-tool)

## Generate (admin UI / BFF)

**Built** in `backend/src/modules/reports/`. All routes: JWT + ADMIN. The browser never
hits cht-reports or the Hub packet.

- `POST /api/reports` → 202.
  Body: `{ campaignId, sources?[], dateRangeDays?: 30|60|90, templateType?, notifyEmails?[] }`.
  `windowStart` / `windowEnd` (ISO 8601) are an alternative to `dateRangeDays`; sending both is 400.
  With neither, the window is campaign start → now.
- Platform freezes `window_start` / `window_end` at request time, then in one transaction
  writes the lock item (sort key `LOCK#{templateType}`, `expires_at`) and the report item
  (`status=queued`, `edit_attempts=0`). Another in-flight report of the same type → 409.
- `SendMessage` `{ reportId, campaignId }` to `cht-{env}-report-requests`. On send failure the
  report is marked `failed` (`enqueue_failed`), the lock is released, and the API returns 503.
- `GET /api/reports/:id?campaignId=` → poll (consistent read when `campaignId` is given,
  otherwise the `report_id-index` GSI).
- `GET /api/reports?campaignId=` → list for a campaign, newest first.
- `POST /api/reports/:id/regenerate` `{ editInstructions? }` → 202. 409 if not complete or
  `edit_attempts >= 3`. Sets `status=queued`, `attempt_count=0`, `edit_instructions`,
  `edit_attempts + 1`, then sends the same `{ reportId, campaignId }`.
- `GET /api/reports/:id/download` → Platform streams the PDF from S3 (`s3_key_pdf`). No S3 or
  presigned URL is ever returned. The key must be under `reports/` and end in `.pdf`, the object
  content type must be PDF (or unset/octet-stream), and the file must start with `%PDF-`;
  anything else (including HTML) is 409.
- IAM: cht-reports resource policies on the table, queue, bucket (`reports/*` GetObject) and
  KMS key grant `cht-{env}-ecs-task`.

Report item fields Platform writes: `campaign_id`, `report_id`, `template_type`, `sources`,
`date_range_days`, `window_start`, `window_end`, `notify_emails`, `status`, `attempt_count`,
`edit_attempts`, `last_error`, `requested_by`, `created_at`, `updated_at` (+ `edit_instructions`
on regenerate). The worker writes `s3_key_pdf` (and optionally `version`) on complete.

## Transcripts (already pulled)

Zoom TRANSCRIPT/CC files are VTT on S3 (`zoom-recordings-pull`). That stays here.

v1 export must include, per session:

- `platformToolProgramId`, `kind`, `title`, `sessionDate`, `zoomMeetingUuid`
- `transcriptS3Key` + `transcriptStatus` (`ok` | `missing`)
- Do **not** inline giant VTT in the API if Hub can GetObject; Hub ingest
  reads the object (grant GetObject on those keys) **or** export returns text.

## ProgramId → campaign (this repo implements the link)

Zoom VTT keys use **programId**, not Hub campaign id:
`zoom-recordings/{programId|unlinked}/{meetingId}/{fileId}.vtt`.

| Work | Owner |
|---|---|
| Add nullable `Program.campaignId` (Hub `campaigns.id`). Admin UI to link. | **cht-platform-tool** (this repo) |
| Include `campaignId` + `platformToolProgramId` + `transcriptS3Key` on export | **cht-platform-tool** (this repo) |
| S3 event Lambda + warehouse upsert | **cht-content-hub** (uses the link; does not invent it) |
| Generate worker | **cht-reports** (no Program model) |

`unlinked` or null `campaignId` → Hub skips that VTT until an admin links the Program.

## Endpoints (confirm)

### This repo (browser JWT unless noted)

| Method | Path | Status | Notes |
|---|---|---|---|
| `POST` | `/api/reports` | **built** | 202. Body: `{ campaignId, sources?[], dateRangeDays?: 30\|60\|90, templateType?, notifyEmails?[] }`. Lock + PutItem, then SQS `{ reportId, campaignId }` |
| `GET` | `/api/reports/:id` | **built** | Poll DDB |
| `GET` | `/api/reports?campaignId=` | **built** | List for a campaign |
| `POST` | `/api/reports/:id/regenerate` | **built** | `{ editInstructions? }`. 409 if not complete or `edit_attempts >= 3` |
| `GET` | `/api/reports/:id/download` | **built** | Streams the PDF through Platform; S3 location never exposed |
| `GET` | `/api/export/reports/campaigns/:campaignId/input-packet` | **built** (CPR-11 auth + CPR-28 packet) | **S2S Cognito M2M** `platform/export.read` + `X-Request-Id`. Sessions/attendance/surveys for linked Programs only. |

Download is streamed by Platform from DDB `s3_key_pdf`. Not a cht-reports HTTP route.

### Other repos (not CHT)

| Method | Path | Repo | Status |
|---|---|---|---|
| `GET` | `/api/campaigns/{id}/report-packet` | cht-content-hub | **built** |
| `GET` | `/health` | cht-reports | health only (no report API) |

Existing CHT admin UI proxy (`/api/admin/content-hub/...`) is the platform-tool Content Hub screens (analytics JSON). There is no separate Hub admin UI. That path is not the PDF generate worker.

## Still to build (CPR-13/14)

- Hub scheduled pull consuming Cognito M2M + S3 GetObject / Lambda warehouse upsert.
- Admin generate BFF (`/api/reports*`) is separate (CPR-F).

`Program.campaignId` + export packet: **shipped** (CPR-28). See `cognito-m2m-export.md`.

## Cognito M2M (Hub → `/api/export/*`)

Locked auth for Content Hub ingest. Companion and admin `/api/reports*` are unchanged.

| Item | Value |
|------|--------|
| Scope | `platform/export.read` |
| Grant | `client_credentials` only |
| App client | `cht-content-hub-export` (confidential) |
| Secrets Manager | `{name_prefix}-cognito-m2m-export` — prod = `cht-platform-cognito-m2m-export` (`platform.tfvars`) |
| Secret JSON | `client_id`, `client_secret`, `token_url`, `scope` |
| Backend env | `COGNITO_M2M_EXPORT_CLIENT_ID` (validates tokens; secret stays in SM for Hub) |

### Smoke (Hub)

```bash
# Resolve credentials (prod / platform.tfvars → cht-platform-cognito-m2m-export)
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id "$M2M_SECRET_NAME" --query SecretString --output text)
CLIENT_ID=$(echo "$SECRET_JSON" | jq -r .client_id)
CLIENT_SECRET=$(echo "$SECRET_JSON" | jq -r .client_secret)
TOKEN_URL=$(echo "$SECRET_JSON" | jq -r .token_url)
SCOPE=$(echo "$SECRET_JSON" | jq -r .scope)

AT=$(curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=$SCOPE" \
  "$TOKEN_URL" | jq -r .access_token)

# 401 without token; with token → 200 + packet (sessions may be empty / transcriptStatus missing)
curl -i -H "Authorization: Bearer $AT" \
  -H "X-Request-Id: $(uuidgen)" \
  "https://$PLATFORM_HOST/api/export/reports/campaigns/{campaignId}/input-packet"
```

Hub implements token POST + Bearer only — no Cognito pool provisioning in Hub.

## Speech-to-text (not v1)

If Zoom VTT is absent, Amazon Transcribe on the MP4 we already store belongs
**here** (we own the media) or in Content Hub ingest if reports-only.
Do not put STT in cht-reports or on the Generate click path.

## Do not

- Render PDF / call Bedrock / own `reports.*` warehouse.
- NLG transcript cleaning (filler words) — cht-reports.
- Serve the generate-time packet — that is Content Hub
  `GET /api/campaigns/{id}/report-packet`.
