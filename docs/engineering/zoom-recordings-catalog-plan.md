# Zoom Recordings Catalog — Implementation Plan

**Status:** In progress (Chunks 0–6 complete; Chunk 7 staging validation; **Chunks 8–10 attendees import — implemented locally**)  
**Owner:** Platform  
**Related:** [zoom-recordings-pull-guide.md](./zoom-recordings-pull-guide.md), [integrations.md](./integrations.md)

Approved scope: account-wide Zoom webinar catalog under **LIVE** (not Reporting), manual Sync, shared S3/files with Program Hub, CHM Content ID naming, reliable large MP4 pulls.

**New client requirement (Aug 2026):** Import Zoom **attendees/participants** for the **last 12 months** (historical backfill), in addition to recordings catalog Sync/Pull.

---

## Chunk 0 — Decisions & scaffolding ✅

### UI placement (confirmed)

| Decision | Choice |
| -------- | ------ |
| Nav location | **LIVE** sidebar item → sub-tabs like Campaigns Dashboard |
| Routes | `/admin/programs` (Sessions), `/admin/programs/zoom-recordings` (catalog) |
| Program Hub | Unchanged at `/admin/programs/:id/hub` (outside LIVE layout) |
| Reporting / Content Hub | **No** Zoom recordings page |

**Frontend files:**
- `frontend/src/pages/admin/AdminLiveLayout.tsx` — LIVE chrome + Sessions \| Zoom Recordings tabs
- `frontend/src/pages/admin/AdminZoomRecordings.tsx` — placeholder catalog page
- `frontend/src/App.tsx` — nested routes under `AdminLiveLayout`
- `frontend/src/pages/admin/AdminPrograms.tsx` — header deferred to layout for webinars

### Sync history default (confirmed)

| Env var | Default | Notes |
| ------- | ------- | ----- |
| `ZOOM_RECORDINGS_SYNC_MONTHS_BACK` | **24** | Clamped 1–120 in `configuration.ts` |

**Backend:** `backend/src/config/configuration.ts` → `zoomRecordings.syncMonthsBackDefault`  
**Ops:** `backend/.env.example`, ECS task env in `infrastructure/terraform/modules/compute/ecs-backend/main.tf`

### Other defaults (carry forward to later chunks)

| # | Topic | V1 default |
| --- | ----- | ---------- |
| D3 | Session types | Webinars only (meetings V1.1) |
| D5 | Job runner | DB job + in-process Nest runner |
| D6 | Unlinked S3 keys | `zoom-recordings/unlinked/{meetingId}/{fileId}.ext` |
| D7 | Auto-pull on Sync | Metadata only; transcripts/MP4 on explicit Pull |
| D8 | Campaigns transcript tab | Out of scope |
| D9 | Attendance import window | **12 months** back (`ZOOM_ATTENDANCE_IMPORT_MONTHS_BACK`, default 12, max 120) |
| D10 | Attendance session types | **Webinars only** in V1 (meetings/office hours V1.1) |
| D11 | Attendance import trigger | Manual admin job (same pattern as recordings Sync); optional per-session import on catalog detail |
| D12 | Attendance storage | Reuse `WebinarParticipantEvent` for linked Programs; staging table for unlinked catalog sessions until Link |
| D13 | Auto-verify after import | **Opt-in per job** (`runAutoVerify: true`); never override DENIED / VERIFIED |

---

## Current attendance vs new import (baseline)

Today attendance is **live-only** — no historical Report API import exists.

| Mechanism | What it does | Historical? |
| --------- | ------------ | ----------- |
| Zoom webhooks (`participant_joined` / `left`) | Writes `WebinarParticipantEvent`; matches CHT user by email | No — forward only |
| Meeting SDK (`POST …/sdk-attendance`) | Same table, `rawPayload.source = meeting_sdk` | No |
| `webinar.ended` / `meeting.ended` | Sets `Program.zoomSessionEndedAt`; calls `autoVerifyAttendanceFromZoomJoins()` | No |
| `zoom-attendance-match.ts` | Email/userId index over JOINED rows → Program Hub `zoomJoined` + auto-verify | Reusable for import |
| Program Hub | Shows `zoomJoined`, Verify/Deny on `ProgramRegistration` | Reads existing JOINED rows only |
| Recordings catalog Sync | Indexes `ZoomRecordingSession` + file stubs | **No participants** |
| Zoom Report API | **Not implemented** (scopes documented in pull guide only) | N/A |

**Mapping chain (unchanged):**

```text
Zoom meeting/webinar id
  → Program.zoomMeetingId (or ZoomRecordingSession → link → Program)
  → WebinarParticipantEvent.programId
  → matchRegistrationsToZoomJoins() → ProgramRegistration.postEventAttendanceStatus
```

**Program Hub must not change:** recordings Pull/View/Download routes, registration list shape, Verify/Deny behavior, and webhook/SDK paths stay as-is. Attendance import only **adds** JOINED evidence rows (and optional auto-verify using existing guarded logic).

---

## Chunk 1 — Database schema & migration ✅

### Models

| Model | Purpose |
| ----- | ------- |
| `ZoomRecordingSession` | Catalog row per `zoomMeetingId` (optional `programId`, `chmProgramId`) |
| `ZoomRecordingFile` | File metadata + S3 location; unique `(zoomMeetingId, zoomRecordingFileId)` |
| `ZoomSyncJob` | Manual account Sync job status (used in Chunk 6) |
| `Program.chmProgramId` | Optional CHM Content ID on Program |

`ProgramZoomRecording` **removed** — data backfilled into new tables.

**Migration:** `backend/prisma/migrations/20260828140000_zoom_recordings_catalog/migration.sql`

**Service updated:** `program-zoom-recordings.service.ts` uses `ZoomRecordingSession` + `ZoomRecordingFile` (Program Hub unchanged at API level).

---

## Chunk 2 — CHM Content ID naming ✅

### Module (`backend/src/modules/zoom-recordings/`)

| File | Role |
| ---- | ---- |
| `chm-content-id.vocab.ts` | Client, program format, asset format, rendition codes |
| `chm-content-id.types.ts` | Types + regex patterns |
| `chm-content-id.util.ts` | Build/parse/validate Program ID + asset filenames |
| `chm-content-id.service.ts` | Nest injectable wrapper |
| `chm-content-id.util.spec.ts` | Unit tests |
| `zoom-recordings.module.ts` | Exports `ChmContentIdService` |

**Patterns:**
- Program ID: `CLIENT-YY-SS_BBBnnn` (e.g. `AZ-25-01_LIV001`)
- Asset file: `CLIENT-YY-SS_BBBnnn_FORMATnn[_RENDITION]_vN.ext`

**Wired into Pull:** When `Program.chmProgramId` is set, `ProgramZoomRecordingsService` stores `chmAssetFilename` and uses it for presigned download names.

**Note:** Vocabularies are starter set from CHM workbook — extend via `chm-content-id.vocab.ts` through governance.

---

## Chunk 3 — Zoom account API + date windows ✅

| File | Role |
| ---- | ---- |
| `zoom.service.ts` | `listAccountRecordingsPage`, `listAccountRecordingsInRange`, `downloadRecordingFileStream` |
| `zoom.service.recordings.spec.ts` | Unit tests for account list + stream |
| `zoom-sync-date.util.ts` | `buildMonthWindows`, `syncWindowFromMonthsBack`, `formatZoomApiDate` |
| `zoom-sync-date.util.spec.ts` | Date window tests |

Scope: `cloud_recording:read:list_account_recordings:admin` required on Zoom S2S app.

---

## Chunk 4 — Shared pull/sync/storage services ✅

| File | Role |
| ---- | ---- |
| `zoom-recordings-media.util.ts` | S3 keys, content types, stream vs buffer helpers |
| `zoom-recordings-storage.service.ts` | S3 buffer + multipart stream upload (`@aws-sdk/lib-storage`) |
| `zoom-recordings-session.service.ts` | Session upsert, file stubs, link to program |
| `zoom-recordings-pull.service.ts` | Shared pull logic; MP4/M4A stream to S3 |
| `zoom-recordings-sync.service.ts` | Manual account sync (in-process job runner) |
| `zoom-recordings-catalog.service.ts` | Catalog list/detail/download |
| `zoom-recordings-pull.service.spec.ts` | Pull + multipart tests |
| `program-zoom-recordings.service.ts` | Thin Program Hub facade (API unchanged) |

**Config:** `zoomRecordings.streamFileTypes`, `zoomRecordings.multipartPartSizeMb`

---

## Chunk 5 — Admin API routes ✅

**Controller:** `admin-zoom-recordings.controller.ts` → `/admin/zoom-recordings/*`

| Method | Route | Purpose |
| ------ | ----- | ------- |
| GET | `/sessions` | Paginated catalog list (`page`, `pageSize`, `linked`, `q`) |
| GET | `/sessions/:sessionId` | Session detail + files |
| POST | `/sessions/:sessionId/pull` | Pull files into S3 |
| GET | `/sessions/:sessionId/files/:fileId/download-url` | Presigned View/Download |
| POST | `/sessions/:sessionId/link` | Link session to existing Program |
| POST | `/sync` | Start manual account sync |
| GET | `/sync/latest` | Most recent sync job |
| GET | `/sync/:jobId` | Sync job status + progress |

Program Hub routes under `/admin/programs/:id/recordings*` are unchanged.

---

## Chunk 6 — Frontend catalog ✅

| File | Role |
| ---- | ---- |
| `frontend/src/api/admin.ts` | Catalog + sync API client methods |
| `AdminZoomRecordings.tsx` | List, search, linked filter, Sync + job polling |
| `AdminZoomRecordingDetail.tsx` | Session detail, Pull, link to Program, files |
| `ZoomRecordingFilesTable.tsx` | Shared View/Download table (catalog + Program Hub) |
| `App.tsx` | Route `/admin/programs/zoom-recordings/:sessionId` |

---

## Chunk 7 — Recordings staging validation (remaining)

- Run migration on dev/staging/prod
- Confirm Zoom S2S scopes for **recordings** account Sync (see pull guide; resolve 4711 if present)
- Smoke: Sync → Pull → View/Download; Program Hub Pull unchanged
- Update `zoom-recordings-pull-guide.md` §7 (catalog routes, new tables)

---

## Chunk 8 — Zoom Report API + session inventory for attendees

### Goal

Fetch **past participant lists** from Zoom for webinars in the last **12 months**, using the recordings catalog session list as the primary inventory.

### Zoom APIs (new)

| API | Use | Scope (S2S) |
| --- | --- | ----------- |
| `GET /report/webinars/{webinarId}/participants` | Past **webinar** attendees (V1) | `report:read:list_webinar_participants:admin` |
| `GET /report/meetings/{meetingId}/participants` | Past **meeting** attendees (V1.1) | `report:read:list_meeting_participants:admin` |
| `GET /report/webinars/{webinarId}` | Session metadata / confirm instance id | `report:read:webinar:admin` |
| (existing) `GET /accounts/{accountId}/recordings` | Session inventory via recordings Sync | `cloud_recording:read:list_account_recordings:admin` |

**Not the same as recordings Sync** — Report API returns **who attended**, not cloud recording files.

### Session inventory strategy

1. **Primary:** Reuse `ZoomRecordingSession` rows from recordings Sync (already has `zoomMeetingId`, `zoomUuid`, `sessionType`, `startTime`, optional `programId`).
2. **Filter:** `startTime` within `ZOOM_ATTENDANCE_IMPORT_MONTHS_BACK` (default **12**); V1 `sessionType = WEBINAR` only.
3. **Gap:** Webinars with attendees but **no cloud recording** may be missing from recordings Sync → optional Phase 2: account past-meetings list or Dashboard Report API. Document as known V1 gap; do not block V1 on full account inventory.

### Pagination & API limits

| Limit | Handling |
| ----- | -------- |
| Report participants `page_size` max **300** | Loop `next_page_token` until empty (mirror `listAccountRecordingsInRange`) |
| Rate limits (429) | Exponential backoff per session; record in job progress |
| Webinar id vs UUID | Use numeric `zoomMeetingId` first; on 404 retry with double-encoded `zoomUuid` (reuse `encodeMeetingIdForPath`) |
| Report retention | Zoom may restrict very old reports by plan; job logs per-session 404 as skip (not fatal) |
| Completed sessions only | Skip future sessions; skip rows with no `startTime` in window |

### Backend files (new / extended)

| File | Role |
| ---- | ---- |
| `zoom.service.ts` | `listWebinarReportParticipantsPage`, `listWebinarReportParticipants`, meeting variant V1.1 |
| `zoom.service.report.spec.ts` | Pagination, id encoding, error mapping |
| `zoom-report-date.util.ts` | `attendanceImportWindowFromMonthsBack` (12mo default) |
| `zoom-attendance-import.service.ts` | Per-session fetch → upsert → optional auto-verify |

---

## Chunk 9 — Database + idempotent storage

### Schema changes

**Extend `WebinarParticipantEvent`** (do not replace — keeps Program Hub + webhooks working):

| Field | Purpose |
| ----- | -------- |
| `source` | `WEBHOOK` \| `MEETING_SDK` \| `REPORT_IMPORT` (default `WEBHOOK` for existing rows) |
| `joinTime` | From Report API `join_time` (distinct from `occurredAt` ingest time) |
| `leaveTime` | Optional from report `leave_time` |
| `durationSeconds` | Optional from report `duration` |
| `importJobId` | FK to job for audit |

**Unique constraint (import idempotency):**

```text
(programId, zoomParticipantId, event, source, joinTime)
```

- Re-import same session → upsert, no duplicate JOINED rows.
- Webhook rows (`source = WEBHOOK`) unchanged — no unique clash if `joinTime` null on webhooks.

**New `ZoomAttendanceImportJob`** (mirror `ZoomSyncJob`):

| Field | Purpose |
| ----- | -------- |
| `monthsBack`, `fromDate`, `toDate` | 12-month window |
| `sessionTypeFilter` | WEBINAR V1 |
| `status`, `progressJson`, `errorMessage` | Same pattern as recordings Sync |
| `runAutoVerify` | Whether to call `autoVerifyAttendanceFromZoomJoins` per linked program after import |

**Staging (unlinked catalog sessions):** `ZoomAttendanceParticipant` (or JSON on session) until `programId` set:

| Field | Purpose |
| ----- | -------- |
| `sessionId` → `ZoomRecordingSession` | Catalog row before Link |
| `zoomParticipantId`, `name`, `email`, `joinTime`, `durationSeconds` | Raw report row |
| Unique `(sessionId, zoomParticipantId, joinTime)` | Idempotent |

**On Link** (`POST …/sessions/:id/link`): copy staging rows → `WebinarParticipantEvent` with `source = REPORT_IMPORT`, then delete staging (or mark migrated).

**Migration:** new file under `backend/prisma/migrations/` (after recordings catalog migration).

### Duplicate handling

| Case | Behavior |
| ---- | -------- |
| Re-run 12-month import job | Upsert by unique key; counts in job progress |
| Webhook JOINED + Report JOINED same person | Both may exist (webhook has no `joinTime` unique); matching uses **any** JOINED (`buildZoomJoinIndex` already dedupes by email/userId) |
| Same email, different `zoomParticipantId` | Store both; match uses email set |
| Host / panelist | `isHost` from report `role` / `internal_user` |
| No email in report | Store row; no `userId` match; show in UI as unmatched |
| No CHT `ProgramRegistration` | Row stored; Program Hub shows Zoom-only attendee list on catalog; no auto-verify target |

### Mapping to Programs

```text
ZoomRecordingSession.programId set?
  yes → WebinarParticipantEvent.programId = programId
  no  → ZoomAttendanceParticipant (staging) until admin Links session
Program.zoomMeetingId must match session.zoomMeetingId (existing link rules)
```

**Do not auto-create Programs** for attendance-only sessions (same D as recordings catalog).

---

## Chunk 10 — Admin API, job runner, UI

### Admin API (new routes)

Extend `admin-zoom-recordings.controller.ts` or sibling `admin-zoom-attendance.controller.ts`:

| Method | Route | Purpose |
| ------ | ----- | ------- |
| `POST` | `/admin/zoom-recordings/attendance/import` | Start 12-month import job (`monthsBack?`, `runAutoVerify?`) |
| `GET` | `/admin/zoom-recordings/attendance/import/latest` | Latest job status |
| `GET` | `/admin/zoom-recordings/attendance/import/:jobId` | Job detail + progress |
| `POST` | `/admin/zoom-recordings/sessions/:sessionId/attendance/import` | Import attendees for **one** catalog session |
| `GET` | `/admin/zoom-recordings/sessions/:sessionId/attendance` | List attendees (staging or `WebinarParticipantEvent` via program) |

**Program Hub — no new routes required** if linked sessions populate `WebinarParticipantEvent`; existing `GET …/registrations` already exposes `zoomJoined` / `zoomParticipantEmail`.

Optional (V1.1): `GET /admin/programs/:id/attendees` read-only list of all JOINED report rows for hub display.

### Job runner

Same pattern as `ZoomRecordingsSyncService`:

1. Admin clicks **Import attendees** (catalog layout) or per-session button on detail.
2. Create `ZoomAttendanceImportJob` (QUEUED → RUNNING).
3. Load sessions in date window from `ZoomRecordingSession` (webinars only).
4. For each session: fetch all report pages → upsert staging or `WebinarParticipantEvent`.
5. If `programId` + `runAutoVerify`: call existing `autoVerifyAttendanceFromZoomJoins(programId)` (guarded — no override of VERIFIED/DENIED).
6. Update `progressJson`: `{ sessionsTotal, sessionsDone, participantsUpserted, registrationsAutoVerified, errors[] }`.

**In-process Nest runner** (D5) for V1; SQS worker only if jobs exceed HTTP timeout (likely for 12mo × many webinars).

### Frontend

| Location | Change |
| -------- | ------ |
| `AdminZoomRecordingsLayout.tsx` | **Import attendees** button + job status banner (mirror Sync) |
| `AdminZoomRecordingDetail.tsx` | **Attendees** section/tab: table (name, email, join time, duration, matched registration Y/N, source) + **Import attendees** for this session |
| `AdminProgramHub.tsx` | **No behavior change** — existing `zoomJoined` / Verify/Deny picks up imported JOINED rows automatically |
| `AdminWebinarApprovals.tsx` | Optional: badge if backfill added new match candidates (V1.1) |

### Config

| Env | Default | Purpose |
| --- | ------- | ------- |
| `ZOOM_ATTENDANCE_IMPORT_MONTHS_BACK` | `12` | Historical window |
| `ZOOM_ATTENDANCE_IMPORT_AUTO_VERIFY` | `false` | Default off; admin opt-in per job |

Add to `configuration.ts`, `.env.example`, ECS terraform (same module as recordings Sync).

---

## Chunk 11 — Tests & docs

### Tests

| Area | Coverage |
| ---- | -------- |
| `zoom.service.report.spec.ts` | Report API pagination, UUID fallback, 404/403 mapping |
| `zoom-attendance-import.service.spec.ts` | Upsert idempotency, staging → program migration on link, job progress |
| `zoom-attendance-match.spec.ts` | Extend if import adds edge cases (report-only email) |
| `program-registrations.service.spec.ts` | Auto-verify still only touches `PENDING_VERIFICATION` after import |
| `zoom-webhook.service.spec.ts` | Regression — webhooks unchanged |
| `program-zoom-recordings.service.spec.ts` | Regression — Program Hub recordings unchanged |

### Docs

- Update `zoom-recordings-pull-guide.md`: Report scopes, attendance import endpoints, 12-month job, distinction from recordings Sync.
- Update `integrations.md`: webhook attendance + historical import coexistence.

---

## Remaining chunks (summary)

Order:

1. ~~Schema + migration + backfill (recordings)~~ ✅
2. ~~CHM Content ID module~~ ✅
3. ~~Zoom account recordings API + date windows~~ ✅
4. ~~Shared pull/sync/storage services + multipart MP4~~ ✅
5. ~~Admin API routes (recordings)~~ ✅
6. ~~Frontend catalog list, sync polling, detail, Program Hub shared table~~ ✅
7. Recordings docs, scopes, staging validation
8. Zoom Report API + session inventory for attendees
9. DB schema + idempotent attendance storage + staging
10. Admin API, import job runner, catalog UI (attendees tab)
11. Tests, docs, staging validation (attendees)

---

## Risk register (attendees)

| Risk | Mitigation |
| ---- | ---------- |
| Report scopes missing / 4711 (same token issue as recordings Sync) | Verify JWT `scp` includes report scopes before prod; surface Zoom error body in job UI |
| Sessions without cloud recordings missing from inventory | Document V1 gap; Phase 2 past-meetings inventory |
| Import job runtime (12mo × N webinars) | Progress JSON + per-session errors; optional `sessionIds` filter on job |
| Duplicate webhook + import rows | Matching already dedupes; optional UI “sources” column V1.1 |
| Auto-verify surprises | Default `runAutoVerify: false`; admin opt-in; never override DENIED |
| Program Hub regression | No changes to recordings facade; attendance import is additive; webhook tests stay green |
