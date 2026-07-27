# Content Hub: CHT proxy implementation guide

**Status:** Implementation runbook  
**Audience:** CHT backend + frontend engineers  
**Related:** [content-hub-report-api-contract.md](./content-hub-report-api-contract.md) (full API contract)  
**Hub repo:** `cht-content-hub`: admin API at `/api/admin/*`

---

## Overview

The Content Hub admin UI (`/admin/content-hub`) today uses **localStorage** via `frontend/src/pages/admin/content-hub/lib/store.ts`. To go live:

1. **CHT NestJS** exposes `/api/admin/content-hub/*` (admin JWT).
2. CHT proxies to **Content Hub** `/api/admin/*` (server-to-server `X-API-Key`).
3. **HubSpot** stays on CHT only: never proxied to Hub for token/sync UI.

The browser **never** calls Content Hub directly.

```
Admin UI  →  CHT /api/admin/content-hub/*  →  Hub /api/admin/*
                    └─ HubSpot API (CHT only, manual sync)
```

---

## Prerequisites

Deploy Content Hub to dev first (migrations through `0006`, API image, ACM cert).

### Environment variables (dev)

```bash
# KOL: existing
CONTENTHUB_BASE_URL=https://devhub.communityhealth.media/api/public
CONTENTHUB_API_KEY=<Hub Secrets Manager public_api_key>

# Campaign admin: new (or derive: baseUrl.replace('/api/public', '/api/admin'))
CONTENTHUB_ADMIN_BASE_URL=https://devhub.communityhealth.media/api/admin

# HubSpot: existing (CHT only)
HUBSPOT_ACCESS_TOKEN=...

# Cache clear: Hub calls after writes (optional on Hub until URL is set)
INTERNAL_CACHE_SECRET=...
```

Same `CONTENTHUB_API_KEY` works for admin routes on Hub today (`ADMIN_API_KEY` falls back to public key).

---

## What already exists in CHT

| Piece | Location | Notes |
|-------|----------|-------|
| HTTP client | `backend/src/modules/content-hub/content-hub-client.service.ts` | `get` + `post`, Redis cache on GET |
| KOL proxy pattern | `backend/src/modules/kol-network/content-hub-kol.service.ts` | Thin wrapper over client |
| Admin controller pattern | `backend/src/modules/kol-network/admin-kol-network.controller.ts` | JWT + `@Roles(ADMIN)` |
| HubSpot service | `backend/src/modules/hubspot/hubspot.service.ts` | Contact sync; extend for campaign analytics |
| Cache clear | `backend/src/cache/cache-clear.service.ts` | `scope=contenthub` → `cht:contenthub:*` |
| Frontend seam | `frontend/src/pages/admin/content-hub/lib/store.ts` | Swap bodies to `apiClient` |
| Frontend hooks | `frontend/src/pages/admin/content-hub/lib/hooks.ts` | Keep query keys; store becomes async |
| API client | `frontend/src/api/client.ts` | Session cookie / Bearer |

---

## Backend work

### 1. Config

Add to `backend/src/config/configuration.ts` and `validation.ts`:

```typescript
contenthub: {
  baseUrl: process.env.CONTENTHUB_BASE_URL || '',           // /api/public
  adminBaseUrl: process.env.CONTENTHUB_ADMIN_BASE_URL || '', // /api/admin
  apiKey: process.env.CONTENTHUB_API_KEY,
}
```

Update `backend/.env.example`.

### 2. Extend `ContentHubClientService`

Add:

| Method | Purpose |
|--------|---------|
| `patch<T>(path, body)` | Campaign update, integrations, HubSpot PATCH to Hub |
| `delete(path)` | Delete campaign / template |

**Caching:**

| Cache GET? | Routes |
|------------|--------|
| Yes (short TTL, optional) | `GET /campaigns`, `GET /templates`, `GET /integrations` |
| **No** | Reports, validation, platform-data, sync, uploads |

Add `get(path, params, { cache: false })` or `getUncached()`.

Use **`adminBaseUrl`** for campaign paths (not `baseUrl` used by KOL).

After any Hub write or HubSpot PATCH → `CacheClearService.clear('contenthub')`.

### 3. New `ContentHubCampaignService`

Create `backend/src/modules/content-hub/content-hub-campaign.service.ts`.

Thin wrapper: paths relative to admin base:

| Service method | Hub |
|----------------|-----|
| `listCampaigns(q?)` | `GET /campaigns` |
| `getCampaign(id)` | `GET /campaigns/:id` |
| `createCampaign(body)` | `POST /campaigns` |
| `updateCampaign(id, body)` | `PATCH /campaigns/:id` |
| `deleteCampaign(id)` | `DELETE /campaigns/:id` |
| `getPlatformData(id)` | `GET /campaigns/:id/platform-data` |
| `syncPlatform(id, platform)` | `POST /campaigns/:id/platforms/:platform/sync` |
| `syncAll(id)` | `POST /campaigns/:id/sync-all` |
| `uploadCsv(id, body)` | `POST /campaigns/:id/uploads` |
| `getValidation(id)` | `GET /campaigns/:id/validation` |
| `generateReport(id)` | `POST /campaigns/:id/report/generate` |
| `generateExecutiveReport(id)` | `POST /campaigns/:id/executive-report/generate` |
| `generateInsights(id)` | `POST /campaigns/:id/insights` |
| `listTemplates()` | `GET /templates` |
| `createTemplate(body)` | `POST /templates` |
| `deleteTemplate(id)` | `DELETE /templates/:id` |
| `getIntegrations()` | `GET /integrations` |
| `patchIntegrations(body)` | `PATCH /integrations` |

### 4. New `AdminContentHubController`

Create `backend/src/modules/content-hub/admin-content-hub.controller.ts`.

Mirror guards from `admin-kol-network.controller.ts`:

```typescript
@Controller('admin/content-hub')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
```

#### Pass-through routes

| Browser (CHT) | Action |
|---------------|--------|
| `GET/POST /admin/content-hub/campaigns` | Proxy to Hub |
| `GET/PATCH/DELETE /admin/content-hub/campaigns/:id` | Proxy |
| `GET .../campaigns/:id/platform-data` | Proxy |
| `POST .../platforms/:platform/sync` | Proxy + cache clear |
| `POST .../sync-all` | Proxy + cache clear |
| `POST .../uploads` | Proxy + cache clear |
| `GET .../validation` | Proxy (no cache) |
| `POST .../insights` | Proxy + cache clear |
| `GET/PATCH .../integrations` | Proxy (merge HubSpot hint on GET) |
| Templates CRUD | Proxy |

#### Report orchestration (special)

Browser uses **GET**; Hub uses **POST .../report/generate**.

```typescript
// GET /admin/content-hub/campaigns/:id/report
async getAnalyticsReport(id: number) {
  await this.campaigns.getCampaign(id);
  await this.campaigns.getPlatformData(id);
  return this.campaigns.generateReport(id);
}

// GET /admin/content-hub/campaigns/:id/executive-report
async getExecutiveReport(id: number) {
  return this.campaigns.generateExecutiveReport(id);
}
```

- Do **not** call HubSpot at report time.
- Do **not** cache report JSON.

Reports read **stored** platform data + `hubspotRawData` on the Hub campaign (from last HubSpot sync).

#### HubSpot (CHT only: not proxied to Hub integrations)

| Browser (CHT) | Implementation |
|---------------|----------------|
| `GET /admin/content-hub/integrations/hubspot/status` | `HubSpotService.getAccountMetadata()` (token introspection → portal id / hub domain) |
| `POST /admin/content-hub/campaigns/:id/hubspot/sync` | See flow below |

**HubSpot sync flow:**

1. `GET` Hub campaign (`hubspotCampaignId`, reporting period).
2. If `!hubspot.isConfigured()` → `400`.
3. Call HubSpot API (campaign + metrics + period email statistics → `hubspotRawData`).
4. **`PATCH` Hub campaign** with `{ hubspotSyncedAt, hubspotRawData }`.
5. `CacheClearService.clear('contenthub')`.
6. Return `{ synced: true, syncedAt, warnings?, errors? }`.

**Integrations GET**, include static HubSpot block (no token field):

```json
{
  "hubspot": {
    "managedBy": "cht",
    "note": "HUBSPOT_ACCESS_TOKEN in platform secrets. Use Sync on campaign detail."
  }
}
```

Platform connector status comes from Hub `GET /integrations`.

### 5. Module wiring

Create `admin-content-hub.module.ts`:

- Import `ContentHubModule`, `HubSpotModule`, cache module.
- Register controller + `ContentHubCampaignService`.
- Export service if needed elsewhere.

Add to `backend/src/app.module.ts`.

---

## Frontend work

### Swap `store.ts`

Replace localStorage with `apiClient` (`frontend/src/api/client.ts`).  
Make exported functions **`async`**: hooks already accept promises.

```typescript
import apiClient from '../../../../api/client';

export async function listCampaigns(): Promise<Campaign[]> {
  const { data } = await apiClient.get('/admin/content-hub/campaigns');
  return data.items;
}

export async function getCampaign(id: number): Promise<Campaign> {
  const { data } = await apiClient.get(`/admin/content-hub/campaigns/${id}`);
  return data;
}

export async function getAnalyticsReport(id: number): Promise<AnalyticsReport> {
  const { data } = await apiClient.get(`/admin/content-hub/campaigns/${id}/report`);
  return data;
}
```

Map every function in `store.ts` to the CHT routes in the contract.  
**Do not change** `hooks.ts` query keys unless adding new queries (e.g. `platform-data`).

### UI updates

| File | Change |
|------|--------|
| `CampaignDetail.tsx` | Show `platform-data` (`fetchDate`, `syncedAt`, stale badge) |
| `UploadData.tsx` | Keep CSV upload; add **Sync** → `POST .../platforms/:platform/sync` |
| `Integrations.tsx` | Remove HubSpot token input; status from CHT `hubspot/status` |
| `types.ts` | Add `fetchDate`, `PlatformSnapshot` if missing |

Remove client-side report building from `reports.ts` once Hub returns full report JSON (keep types aligned with Hub response).

---

## Route map (quick reference)

| CHT (browser) | Hub (server-to-server) |
|---------------|------------------------|
| `GET /admin/content-hub/campaigns` | `GET /campaigns` |
| `GET /admin/content-hub/campaigns/:id` | `GET /campaigns/:id` |
| `POST /admin/content-hub/campaigns` | `POST /campaigns` |
| `PATCH /admin/content-hub/campaigns/:id` | `PATCH /campaigns/:id` |
| `DELETE /admin/content-hub/campaigns/:id` | `DELETE /campaigns/:id` |
| `GET .../platform-data` | `GET /campaigns/:id/platform-data` |
| `POST .../platforms/:p/sync` | `POST /campaigns/:id/platforms/:p/sync` |
| `POST .../sync-all` | `POST /campaigns/:id/sync-all` |
| `POST .../uploads` | `POST /campaigns/:id/uploads` |
| `GET .../validation` | `GET /campaigns/:id/validation` |
| `GET .../report` | orchestrate → `POST /campaigns/:id/report/generate` |
| `GET .../executive-report` | orchestrate → `POST .../executive-report/generate` |
| `POST .../insights` | `POST /campaigns/:id/insights` |
| `GET/PATCH .../integrations` | Hub `/integrations` + HubSpot hint on GET |
| `GET .../hubspot/status` | **CHT only** |
| `POST .../hubspot/sync` | **CHT** → HubSpot → PATCH Hub campaign |

---

## Files to add or change

```
backend/src/modules/content-hub/
  content-hub-client.service.ts      ← patch/delete, adminBaseUrl, cache opt-out
  content-hub-campaign.service.ts    ← NEW
  admin-content-hub.controller.ts    ← NEW
  admin-content-hub.module.ts        ← NEW

backend/src/config/configuration.ts
backend/src/config/validation.ts
backend/.env.example
backend/src/app.module.ts

frontend/src/pages/admin/content-hub/lib/
  store.ts                           ← apiClient (async)
  hooks.ts                           ← optional platform-data query
  types.ts
```

---

## Testing

### 1. Hub direct (after deploy)

```bash
export KEY=$CONTENTHUB_API_KEY

curl -s -H "X-API-Key: $KEY" \
  https://devhub.communityhealth.media/api/admin/campaigns

curl -s -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"name":"Proxy test","platforms":["linkedin"]}' \
  https://devhub.communityhealth.media/api/admin/campaigns
```

### 2. CHT proxy (after backend work)

```bash
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  https://devapp.communityhealth.media/api/admin/content-hub/campaigns
```

### 3. End-to-end (UI)

1. Create campaign  
2. Upload CSV (or stub sync via integrations)  
3. Open analytics report  
4. HubSpot sync → verify report includes HubSpot data  
5. Confirm `platform-data` shows `fetchDate` / `syncedAt`

---

## Phases

### Phase 1: Unblock UI (no platform APIs)

- [ ] Config: `CONTENTHUB_ADMIN_BASE_URL`
- [ ] Extend client + campaign service + admin controller
- [ ] Report orchestration (GET → POST generate on Hub)
- [ ] HubSpot status + sync → PATCH Hub campaign
- [ ] Cache clear on writes
- [x] Frontend `store.ts` swap (campaign CRUD, uploads, reports, HubSpot sync/status)
- [ ] CSV bootstrap + stub platform sync on Hub

### Phase 2: Production quality

- [x] Real HubSpot campaign analytics in sync handler
- [ ] Hub daily cron + real platform connectors (Hub-side)
- [ ] Port report builder fully (Hub `campaign_reports.py` / former `reports.ts`)
- [ ] UI: prefer Sync over Upload where connectors exist

---

## Ownership reminder

| Concern | Owner |
|---------|-------|
| Campaign CRUD, platform data, reports (logic) | Content Hub |
| LinkedIn / Meta / YouTube credentials & sync | Content Hub |
| HubSpot token & API | CHT |
| Admin auth, proxy, report orchestration | CHT |
| Browser | CHT only |

CHT never stores platform metric rows long-term. Hub never stores HubSpot tokens.

---

## See also

- [content-hub-report-api-contract.md](./content-hub-report-api-contract.md): full request/response shapes
- [cache-sync-contract.md](../runbooks/cache-sync-contract.md): `POST /internal/cache/clear?scope=contenthub`
- Hub contract copy: `cht-content-hub/docs/contenthub-campaign-report-api-contract.md`
