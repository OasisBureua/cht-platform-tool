# Content Hub: Campaign & Report API Contract

**Status:** Draft (for Hub implementation + CHT proxy)  
**Audience:** Content Hub backend, CHT platform backend, CHT admin UI  
**UI source:** `frontend/src/pages/admin/content-hub/lib/store.ts` + `types.ts`  
**Related:** KOL producer API (`GET /api/public/kols*`): separate surface, same Hub service

---

## Architecture

```
CHT Admin UI (/admin/content-hub)
    → CHT NestJS  /api/admin/content-hub/*
        ├─→ Content Hub  (pull campaign + platform snapshots at report time)
        ├─→ Content Hub  POST .../report/generate  (or Hub builds from its DB)
        └─→ HubSpot API  (CHT only: on manual HubSpot sync, not every report view)

Content Hub (background + storage)
    ├─ Daily cron: resync platform data per active campaign
    ├─ On-demand: POST .../campaigns/{id}/platforms/{platform}/sync  (admin “Refresh data”)
    └─ Postgres: campaign_platform_snapshots + hubspot_raw_data on campaign
```

| Layer | Responsibility |
|-------|----------------|
| **Content Hub** | **Store** all non-HubSpot platform data, connectors, daily + manual sync, **report builder** (given snapshots in DB) |
| **CHT** | Admin auth, **orchestrate reports** (pull latest from Hub → invoke report build → return to UI), **HubSpot sync only**, short-lived cache only |
| **Browser** | Calls CHT only; never Content Hub directly |

### Ownership split

| Concern | Owner | Notes |
|---------|--------|--------|
| Campaign CRUD, templates | **Content Hub** | Hub Postgres |
| LinkedIn / Meta / YouTube / livestream / survey data | **Content Hub** | Stored as normalized snapshots per campaign + platform |
| Platform connector credentials (non-HubSpot) | **Content Hub** | Encrypted in Hub secrets / integration config |
| Daily platform resync | **Content Hub** | Scheduled job (e.g. 02:00 UTC) for campaigns in `draft` … `final` |
| Manual “pull fresh data” | **Content Hub** | Admin action: `POST .../platforms/{platform}/sync` or `sync-all` (proxied via CHT). **Not** implicit on every report view. |
| Report generation (orchestration) | **CHT** | On `GET .../report`, CHT **pulls** latest campaign + snapshots **from Hub**, then asks Hub to build (or builds from pulled payload) |
| Report generation (logic) | **Content Hub** | `reports.ts` port: operates on snapshots Hub already has |
| HubSpot token + API calls | **CHT** | `HUBSPOT_ACCESS_TOKEN`, extend `HubSpotService` |
| HubSpot snapshot on campaign | **CHT writes → Hub stores** | After CHT pull, `PATCH` campaign `hubspotSyncedAt` + `hubspotRawData` |
| `hubspotCampaignId` | **Content Hub** | Campaign metadata |

**Rule of thumb:** If it is not HubSpot, Content Hub owns the data lifecycle (store, sync, validate, report). CHT never holds LinkedIn/Meta/YouTube rows.

Content Hub **never** calls HubSpot. CHT **never** stores non-HubSpot platform metrics long-term.

### Fresh data vs reports

| Action | What happens |
|--------|----------------|
| Admin clicks **Sync / Refresh** | Content Hub pulls from external platform → updates `campaign_platform_snapshots`. HubSpot sync goes through CHT → PATCHes `hubspot_raw_data` on campaign. |
| Admin opens **Analytics / Exec report** | CHT **reads current stored state from Hub** and generates the report document. Does **not** call LinkedIn/Meta/YouTube live unless admin synced first. |
| Daily cron | Content Hub refreshes platform snapshots automatically. |

Reports always reflect **what Hub has stored at generation time**. Stale data → admin runs on-demand sync, then re-opens the report.

Auth:

| Caller | Header |
|--------|--------|
| CHT → Content Hub | `X-API-Key: ${CONTENTHUB_API_KEY}`, `X-Request-Id: <uuid>` |
| Browser → CHT | Session cookie / Bearer (existing admin JWT) |

After Hub writes that affect read models, Hub (or CHT after proxy POST) should trigger  
`POST /api/internal/cache/clear?scope=contenthub` on CHT.

---

## Base URLs

| Environment | Content Hub (implement) | CHT proxy (implement) |
|-------------|-------------------------|------------------------|
| Dev | `https://devhub.communityhealth.media/api/admin` | `https://<dev-domain>/api/admin/content-hub` |
| Prod | `https://contenthub.communityhealth.media/api/admin` | `https://<prod-domain>/api/admin/content-hub` |

JSON bodies unless noted. Timestamps ISO-8601 UTC.  
IDs: UI uses `number` today; Hub may use `bigint` or UUID: **proxy normalizes to `number` or migrate UI to `string`**. Recommend Hub `id` as integer serial for minimal UI churn.

---

## Shared enums

```ts
type Platform = 'linkedin' | 'meta' | 'youtube' | 'livestream' | 'survey';
type CampaignStatus = 'draft' | 'data_needed' | 'ready_for_review' | 'final';
type ReportType = 'analytics' | 'executive';
```

---

## Campaigns

### `GET /campaigns`

List all campaigns (newest first).

**Query:** `q` (optional): search name, sponsor, program  
**Response:** `200`

```json
{
  "items": [ { /* Campaign */ } ],
  "total": 4
}
```

**Maps from:** `store.listCampaigns()`  
**CHT proxy:** `GET /api/admin/content-hub/campaigns`

---

### `GET /campaigns/{id}`

**Response:** `200` Campaign | `404`

**Maps from:** `store.getCampaign(id)`  
**CHT proxy:** `GET /api/admin/content-hub/campaigns/:id`

---

### `POST /campaigns`

Create campaign. Body: partial `Campaign` (server sets `id`, `createdAt`, `updatedAt`, default `status: draft`).

**Response:** `201` Campaign

**Maps from:** `store.createCampaign(body)`  
**CHT proxy:** `POST /api/admin/content-hub/campaigns`

---

### `PATCH /campaigns/{id}`

Partial update. Server sets `updatedAt`.

**Response:** `200` Campaign | `404`

**Maps from:** `store.updateCampaign(id, body)`  
**CHT proxy:** `PATCH /api/admin/content-hub/campaigns/:id`

---

### `DELETE /campaigns/{id}`

Deletes campaign and associated uploads.

**Response:** `204` | `404`

**Maps from:** `store.deleteCampaign(id)`  
**CHT proxy:** `DELETE /api/admin/content-hub/campaigns/:id`

---

### Campaign object

```ts
interface Campaign {
  id: number;
  name: string;
  programName: string;
  clientSponsor: string;
  diseaseState: string;
  treatmentTopic: string;
  reportingPeriodStart: string;   // YYYY-MM-DD
  reportingPeriodEnd: string;
  platforms: Platform[];
  targetAudience: string;
  targetRegions: string;
  targetInstitutions: string;
  physicianSpeakers: string;
  landingPageUrl: string;
  hubspotCampaignId: string;
  eventDate: string;
  livestreamUrl: string;
  hubspotSyncedAt: string | null;      // set by CHT after HubSpot sync
  hubspotRawData: unknown | null;      // written by CHT; Hub stores opaque JSONB if PATCHed
  executiveReportData: Record<string, unknown> | null;
  reportType: ReportType;
  status: CampaignStatus;
  createdBy: string;
  tags: string[];
  templateId: number | null;
  createdAt: string;
  updatedAt: string;
  aiInsights?: string | null;
}
```

---

## Platform data sync (Content Hub)

Each campaign declares `platforms: Platform[]`. For each enabled platform, Hub maintains a **snapshot** (latest pulled metrics + raw payload) and sync metadata.

### Snapshot model

```ts
interface CampaignPlatformSnapshot {
  campaignId: number;
  platform: Platform;
  status: 'missing' | 'syncing' | 'available' | 'error';
  syncedAt: string | null;
  nextSyncAt: string | null;       // set by daily scheduler
  rowCount: number | null;         // normalized metric rows
  error: string | null;
  // raw: stored server-side only: not returned in list APIs
}
```

### `GET /campaigns/{id}/platform-data`

List sync status per platform for a campaign (replaces UI’s upload list over time).

**Response:** `200`

```json
{
  "items": [
    {
      "platform": "linkedin",
      "status": "available",
      "syncedAt": "2026-07-07T06:00:00.000Z",
      "nextSyncAt": "2026-07-08T06:00:00.000Z",
      "rowCount": 128
    }
  ]
}
```

**CHT proxy:** `GET /api/admin/content-hub/campaigns/:id/platform-data`  
**Maps from:** `store.getCsvData()` (UI migration: show sync status instead of upload filenames)

---

### `POST /campaigns/{id}/platforms/{platform}/sync`

**On-demand pull**: admin clicks “Sync” / “Refresh data” on campaign detail.

**Response:** `202` (async) or `200` (sync)

```json
{
  "platform": "linkedin",
  "status": "available",
  "syncedAt": "2026-07-07T14:22:00.000Z",
  "rowCount": 128
}
```

Hub worker calls the platform connector (API or file drop), normalizes rows, upserts snapshot.

**CHT proxy:** `POST /api/admin/content-hub/campaigns/:id/platforms/:platform/sync`

---

### `POST /campaigns/{id}/sync-all`

Refresh all platforms on the campaign (+ optional `?includeHubspot=false`: HubSpot triggered separately via CHT).

**CHT proxy:** `POST /api/admin/content-hub/campaigns/:id/sync-all`

---

### Daily resync (Content Hub scheduler)

- Cron (e.g. `0 6 * * *` UTC): for each campaign where `status != 'archived'`, enqueue sync for each `campaign.platforms` entry.
- Update `nextSyncAt`, `syncedAt`, `status` on `campaign_platform_snapshots`.
- Failed syncs → `status: error`, retain last good snapshot if policy allows.

No CHT involvement in daily platform sync.

---

## CSV uploads (bootstrap / fallback: Content Hub)

Manual CSV upload remains a **v1 bootstrap** when a connector is not wired yet. Long-term, prefer connector sync above.

### `GET /campaigns/{id}/uploads`

**Response:** `200`

```json
{
  "items": [
    {
      "id": 1,
      "campaignId": 3,
      "platform": "linkedin",
      "filename": "linkedin-q2.csv",
      "rowCount": 42,
      "uploadedAt": "2026-06-25T20:00:00.000Z"
    }
  ]
}
```

**Note:** Do not return parsed `rows` in list: storage stays server-side.

**Maps from:** `store.getCsvData(id)`  
**CHT proxy:** `GET /api/admin/content-hub/campaigns/:id/uploads`

---

### `POST /campaigns/{id}/uploads`

**Option A: JSON (matches current UI):**

```json
{
  "platform": "linkedin",
  "filename": "export.csv",
  "content": "Header1,Header2\nval1,val2"
}
```

**Option B: `multipart/form-data`** with `file` + `platform` (preferred long-term).

**Response:** `201` CsvUpload (same shape as list item)

**Server:** Parse CSV, persist as platform snapshot (same store as connector sync), bump `campaign.updatedAt`.

**Maps from:** `store.uploadCsv(id, platform, filename, content)`  
**CHT proxy:** `POST /api/admin/content-hub/campaigns/:id/uploads`

**Deprecation:** UI “Upload” buttons evolve to “Sync” once connectors exist; upload path ingests into the same `campaign_platform_snapshots` table.

---

## Data validation

### `GET /campaigns/{id}/validation`

**Response:** `200` DataValidation

```ts
interface DataValidation {
  hubspotConnected: boolean;
  hubspotSyncedAt: string | null;
  dataSourcesSummary: Array<{
    source: 'HubSpot' | 'LinkedIn' | 'Meta' | 'YouTube' | 'Livestream' | 'Survey';
    status: 'missing' | 'available';
    metricsAvailable: string[];
    metricsMissing: string[];
    lastUpdated: string | null;
  }>;
}
```

**Maps from:** `store.getDataValidation(id)`: logic in `reports.buildDataValidation()`  
**CHT proxy:** `GET /api/admin/content-hub/campaigns/:id/validation`

**Implementation:** **Content Hub** computes validation from `campaign_platform_snapshots` + `hubspot_raw_data` on campaign. CHT proxies; for `hubspotConnected`, CHT may inject `HubSpotService.isConfigured()` into the response or Hub reads a boolean set on last HubSpot PATCH.

---

## HubSpot (CHT only: not on Content Hub)

HubSpot is platform-owned. Token lives in **`HUBSPOT_ACCESS_TOKEN`** (Terraform / Secrets Manager).  
Extend `HubSpotService` for campaign-level marketing analytics pulls (beyond contact upsert).

### `GET /api/admin/content-hub/integrations/hubspot/status` (CHT)

**Response:** `200` HubspotStatus

```ts
interface HubspotStatus {
  connected: boolean;       // HubSpotService.isConfigured()
  accountName: string | null;
  portalId: string | null;
  error?: string;
}
```

**Maps from:** `store.getHubspotStatus()`: **do not** read token from Content Hub.

---

### `POST /api/admin/content-hub/campaigns/{id}/hubspot/sync` (CHT)

1. Load campaign from Content Hub (`hubspotCampaignId`, reporting period).
2. CHT calls HubSpot API with `HUBSPOT_ACCESS_TOKEN`.
3. CHT persists snapshot:
   - **Option A (recommended):** `PATCH` Content Hub campaign with `hubspotSyncedAt` + `hubspotRawData`.
   - **Option B:** CHT table `campaign_hubspot_snapshots` keyed by `campaign_id`.

**Response:** `200`

```json
{ "synced": true, "syncedAt": "2026-06-25T21:00:00.000Z" }
```

**Errors:** `400` if HubSpot not configured | `404` campaign

**Maps from:** `store.hubspotSync(id)`

---

### Integrations UI

- **HubSpot:** status from CHT (`GET .../hubspot/status`); sync button calls CHT `POST .../hubspot/sync` → CHT PATCHes Hub campaign.
- **Other platforms:** configured on **Content Hub** (`GET/PATCH /integrations` on Hub, proxied via CHT). Show last sync time + “Refresh now” per platform, no CSV-only messaging once connectors ship.

---

## AI insights

### `POST /campaigns/{id}/insights`

Requires platform snapshot(s) and/or HubSpot data on the campaign.

**Content Hub:** `POST /campaigns/{id}/insights` reads stored snapshots only (no live external calls except optional LLM).

**Response:** `200`

```json
{ "insights": "..." }
```

Persists to `campaign.aiInsights`.

**Maps from:** `store.generateAiInsights(id)`  
**CHT proxy:** `POST /api/admin/content-hub/campaigns/:id/insights`

---

## Reports

Reports are **requested through CHT** and **built from data pulled from Content Hub** at that moment.

### Flow (analytics + executive)

```
Admin UI  GET /api/admin/content-hub/campaigns/:id/report
    → CHT AdminContentHubService.generateReport(id)
        1. GET Hub /campaigns/{id}
        2. GET Hub /campaigns/{id}/platform-data  (or internal snapshot API)
        3. POST Hub /campaigns/{id}/report/generate
               Hub reads snapshots + hubspot_raw_data from its DB, runs report builder
        4. Return AnalyticsReport JSON to UI
```

CHT may cache list endpoints (`GET /campaigns`) briefly in Redis; **do not** cache full report payloads across sync boundaries, always pull from Hub when generating.

HubSpot is included via `hubspot_raw_data` already on the campaign (last CHT sync). Report generation does **not** re-call HubSpot unless admin ran **HubSpot sync** first.

### `POST /campaigns/{id}/report/generate` (Content Hub)

**Called by CHT** (not browser). Hub loads snapshots from DB, returns built report.

**Response:** `200` AnalyticsReport

```ts
interface AnalyticsReport {
  campaign: Campaign;
  generatedAt: string;
  hubspotData: unknown | null;
  csvData: unknown[];
  sections: AnalyticsReportSections;
  dataValidation: DataValidation;
}
```

**CHT proxy (browser-facing):** `GET /api/admin/content-hub/campaigns/:id/report`  
**Maps from:** `store.getAnalyticsReport(id)`

---

### `POST /campaigns/{id}/executive-report/generate` (Content Hub)

Same pattern as analytics.

**CHT proxy:** `GET /api/admin/content-hub/campaigns/:id/executive-report`  
**Maps from:** `store.getExecutiveReport(id)`

---

### `PATCH /campaigns/{id}/executive-report/config` (optional v2)

UI may edit executive narrative fields (`config.overviewText`, `keyLearnings`, etc.).  
If not in v1, fold into `PATCH /campaigns/{id}` as `executiveReportData`.

---

## Templates

### `GET /templates`

**Response:** `200` `{ "items": Template[] }`

### `POST /templates`

Body: `{ name, type, description }`  
**Response:** `201` Template

### `DELETE /templates/{id}`

**Response:** `204`

**CHT proxy:** `/api/admin/content-hub/templates`, `/templates/:id`

---

## Integrations

### Platform connectors (Content Hub)

`GET /integrations`: connection status per non-HubSpot platform (credentials configured, last global test).

`PATCH /integrations`: update connector config (API keys, ad account ids, etc.). **Stored only on Hub.**

**CHT proxy:** `GET/PATCH /api/admin/content-hub/integrations`

### HubSpot (CHT only)

```json
{
  "hubspot": {
    "managedBy": "cht",
    "note": "HUBSPOT_ACCESS_TOKEN in platform secrets. Use Sync on campaign detail."
  }
}
```

HubSpot status: `GET /api/admin/content-hub/integrations/hubspot/status` (CHT).  
**Do not** store HubSpot token on Content Hub.

---

## CHT module checklist

1. `ContentHubReportsService`: pull from Hub + orchestrate report generation  
2. `AdminContentHubController`: `@Controller('admin/content-hub')`, `@Roles(ADMIN)`  
3. **Report methods:** `GET .../report` → fetch Hub campaign + snapshots → `POST .../report/generate` on Hub → return JSON  
4. **HubSpot only on CHT**: status + `POST .../hubspot/sync` → PATCH Hub campaign  
5. **Proxy** CRUD, platform-data, sync-all, integrations (pass-through to Hub)  
6. Redis: cache campaign **lists** only; invalidate `scope=contenthub` after Hub writes / HubSpot PATCH  
7. Frontend: replace `store.ts`; sync buttons → Hub sync endpoints; reports → CHT GET (which pulls Hub)

---

## Content Hub database (suggested tables)

| Table | Notes |
|-------|--------|
| `campaigns` | Metadata + `executive_report_data` JSONB + `hubspot_raw_data` JSONB (CHT-written) + `hubspot_synced_at` |
| `campaign_platform_snapshots` | `campaign_id`, `platform`, `status`, `synced_at`, `next_sync_at`, `rows` JSONB, `raw` JSONB, `error` |
| `platform_sync_runs` | Audit log: `campaign_id`, `platform`, `trigger` (`daily` \| `manual`), `started_at`, `finished_at`, `status` |
| `integration_settings` | Non-HubSpot connector credentials (encrypted) |
| `report_templates` | Template metadata |

**Not on Hub:** `hubspot_token`  
**Not on CHT:** platform metric rows (except transient during HubSpot pull before PATCH to Hub)

---

## Implementation phases

### Phase 1: MVP (unblock UI + data model)

**Content Hub:**
- [ ] CRUD campaigns  
- [ ] `campaign_platform_snapshots` table + CSV upload ingests into snapshots  
- [ ] `GET .../platform-data`, `GET .../validation`  
- [ ] Report builders read snapshots + `hubspot_raw_data`  

**CHT:**
- [ ] Proxy campaign/platform/report routes  
- [ ] HubSpot status + sync → PATCH Hub campaign  
- [ ] Swap `store.ts`  

### Phase 2: Sync engine (Content Hub)

**Content Hub:**
- [ ] Per-platform connectors (start with one: YouTube or LinkedIn)  
- [ ] `POST .../platforms/{platform}/sync` + `POST .../sync-all`  
- [ ] Daily cron resync for active campaigns  
- [ ] `GET/PATCH /integrations` for non-HubSpot credentials  

**CHT:**
- [ ] Extend `HubSpotService` for campaign analytics pull  

### Phase 3: Polish

- [ ] Templates CRUD  
- [ ] AI insights (Hub)  
- [ ] Executive report config PATCH  
- [ ] Link campaigns to CHT `Program` ids / KOL slugs  
- [ ] UI: “Upload CSV” → “Sync platform data” where connectors exist

---

## Frontend swap (when Hub + proxy exist)

In `frontend/src/pages/admin/content-hub/lib/store.ts`, each function becomes:

```ts
export async function listCampaigns(): Promise<Campaign[]> {
  const { items } = await apiClient.get('/admin/content-hub/campaigns');
  return items;
}
```

Hooks in `lib/hooks.ts` unchanged.

---

## Error shape (both Hub and CHT)

```json
{
  "statusCode": 404,
  "message": "Campaign not found",
  "error": "Not Found"
}
```

NestJS standard: UI already handles axios errors.
