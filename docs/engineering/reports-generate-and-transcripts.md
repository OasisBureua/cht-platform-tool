# Reports generate API + transcript export (cht-platform-tool)

## Generate (admin UI / BFF)

- Replace sync GET executive-report with `POST /api/reports` 202.
  Body: `{ campaignId, sources[], dateRangeDays: 30|60|90, templateType, notifyEmails }`.
- Validate JWT + ADMIN. Compute frozen `window_start` / `window_end`.
- `PutItem` cht-reports DynamoDB (`status=queued`, `edit_attempts=0`, metadata).
- `SendMessage` `{ reportId }` to `cht-reports-*-requests-generate`.
- Lock item `LOCK#{campaignId}#{templateType}` for in-flight collapse.
- `GET /api/reports/:id` → GetItem DDB (poll).
- `GET /api/reports?campaignId=` → GSI list (past artifacts).
- `POST /api/reports/:id/regenerate` `{ editInstructions? }` — 409 if
  not complete or `edit_attempts >= 3`; else enqueue same reportId.
- Download: CHT issues S3 signed URL from DDB `s3_key_pdf`. Browser never
  hits cht-reports (no ALB there).
- IAM: DDB Put/Get/Query + limited UpdateItem for regenerate enqueue; SQS SendMessage.

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

### This repo — to build (browser JWT unless noted)

| Method | Path | Status | Notes |
|---|---|---|---|
| `POST` | `/api/reports` | not built | 202. Body: `{ campaignId, sources[], dateRangeDays: 30\|60\|90, templateType, notifyEmails }`. PutItem + SQS `{ reportId }` |
| `GET` | `/api/reports/:id` | not built | Poll DDB |
| `GET` | `/api/reports?campaignId=` | not built | GSI list |
| `POST` | `/api/reports/:id/regenerate` | not built | 409 if not complete or `edit_attempts >= 3` |
| `GET` | `/api/export/reports/campaigns/:campaignId/input-packet` | **built** (CPR-11 auth + CPR-28 packet) | **S2S Cognito M2M** `platform/export.read` + `X-Request-Id`. Sessions/attendance/surveys for linked Programs only. |

Download: CHT signed S3 URL from DDB. Not a cht-reports HTTP route.

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
