# Internal Cache Clear API

Ops/sync endpoints for invalidating CHT upstream Redis cache. These are **not** for browser or admin UI use — they are intended for workers, CI, and ops scripts.

**Base URL:** `https://<api-host>/api`  
(e.g. `https://devapi.communityhealth.media/api`)

**Auth:** Shared secret `INTERNAL_CACHE_SECRET` (AWS Secrets Manager / ECS env `internal_cache_secret`).

See also: [cache-sync-contract.md](../runbooks/cache-sync-contract.md)

---

## Authentication

You must provide the cache key using **one** of:

| Method | How |
|--------|-----|
| **Query param (preferred)** | `?cacheKey=<INTERNAL_CACHE_SECRET>` |
| **Bearer header** | `Authorization: Bearer <INTERNAL_CACHE_SECRET>` |
| **Custom header** | `x-internal-secret: <INTERNAL_CACHE_SECRET>` |

| Result | HTTP | Message |
|--------|------|---------|
| No credential provided | **400** | `cacheKey query parameter is required (must match INTERNAL_CACHE_SECRET)` |
| Wrong secret | **401** | `Invalid cache key` |
| Secret not configured on server | **401** | `Cache clear is not configured` |

---

## Endpoints

### 1. Clear all namespaces (recommended)

Clears every upstream cache prefix.

```http
POST /api/internal/cache/clear/all?cacheKey=<secret>
```

**Redis patterns cleared:**

- `cht:catalog:*`
- `cht:contenthub:*`
- `cht:kol-network:*`

**Example:**

```bash
curl -X POST \
  "https://devapi.communityhealth.media/api/internal/cache/clear/all?cacheKey=${INTERNAL_CACHE_SECRET}"
```

---

### 2. Clear by scope

Clears one or all namespaces via `scope`.

```http
POST /api/internal/cache/clear?scope=<scope>&cacheKey=<secret>
```

| `scope` | Patterns cleared |
|---------|------------------|
| `all` (default if omitted) | `cht:catalog:*`, `cht:contenthub:*`, `cht:kol-network:*` |
| `catalog` | `cht:catalog:*` only |
| `contenthub` | `cht:contenthub:*`, `cht:kol-network:*` |

**Examples:**

```bash
# All namespaces
curl -X POST \
  "https://devapi.communityhealth.media/api/internal/cache/clear?scope=all&cacheKey=${INTERNAL_CACHE_SECRET}"

# Content Hub / KOL only (after KOL intel or AI brief updates)
curl -X POST \
  "https://devapi.communityhealth.media/api/internal/cache/clear?scope=contenthub&cacheKey=${INTERNAL_CACHE_SECRET}"

# YouTube catalog only
curl -X POST \
  "https://devapi.communityhealth.media/api/internal/cache/clear?scope=catalog&cacheKey=${INTERNAL_CACHE_SECRET}"
```

**Bearer alternative:**

```bash
curl -X POST \
  "https://devapi.communityhealth.media/api/internal/cache/clear?scope=all" \
  -H "Authorization: Bearer ${INTERNAL_CACHE_SECRET}"
```

---

### 3. Legacy — catalog clear (MediaHub worker)

Same behavior as `scope=all`. Kept for existing sync jobs.

```http
POST /api/internal/cache/catalog/clear?cacheKey=<secret>
```

**Example:**

```bash
curl -X POST \
  "https://devapi.communityhealth.media/api/internal/cache/catalog/clear?cacheKey=${INTERNAL_CACHE_SECRET}"
```

---

## Response

**Status:** `200 OK`  
**Content-Type:** `application/json`

```json
{
  "scope": "all",
  "enabled": true,
  "deletedByPattern": {
    "cht:catalog:*": 5,
    "cht:contenthub:*": 12,
    "cht:kol-network:*": 0
  },
  "total": 17,
  "durationMs": 45
}
```

| Field | Type | Description |
|-------|------|-------------|
| `scope` | `string` | `catalog`, `contenthub`, or `all` |
| `enabled` | `boolean` | `false` if Redis is not connected (no keys deleted) |
| `deletedByPattern` | `object` | Keys removed per Redis glob pattern |
| `total` | `number` | Sum of deleted keys across all patterns |
| `durationMs` | `number` | Server-side clear duration in milliseconds |

When Redis is unavailable:

```json
{
  "scope": "all",
  "enabled": false,
  "deletedByPattern": {
    "cht:catalog:*": 0,
    "cht:contenthub:*": 0,
    "cht:kol-network:*": 0
  },
  "total": 0,
  "durationMs": 1
}
```

---

## Error responses

| Status | When |
|--------|------|
| **400** | Invalid `scope` (must be `catalog`, `contenthub`, or `all`) |
| **400** | Missing `cacheKey` and no `Authorization` / `x-internal-secret` header |
| **401** | Wrong secret, or `INTERNAL_CACHE_SECRET` not set on the backend |

---

## What gets cleared

Only **read-through upstream cache** (24h TTL). This does **not** clear user sessions, payments, or database data.

| Prefix | Cached data |
|--------|-------------|
| `cht:catalog:*` | YouTube playlist/channel catalog fallbacks |
| `cht:contenthub:*` | Content Hub KOL network reads |
| `cht:kol-network:*` | Legacy KOL prefix (cleared together with `contenthub`) |

After a clear, the next request is a cache miss → fresh fetch from upstream → key stored again with a 24h TTL.

---

## Ops script

```bash
INTERNAL_CACHE_SECRET=... ./scripts/clear-upstream-cache.sh dev all
INTERNAL_CACHE_SECRET=... ./scripts/clear-upstream-cache.sh dev contenthub
INTERNAL_CACHE_SECRET=... ./scripts/clear-upstream-cache.sh dev catalog
```

---

## When to use which scope

| Event | Recommended call |
|-------|------------------|
| MediaHub sync completed | `scope=all` or legacy `POST .../catalog/clear` |
| Content Hub KOL / AI brief updated | `scope=contenthub` |
| Full cache reset / deploy verification | `POST .../clear/all` or `scope=all` |
| YouTube-only refresh | `scope=catalog` |

---

## Server logging

Each request logs:

- Scope and auth method (`query`, `bearer`, or `header`)
- Per-pattern delete counts
- Total keys deleted and `durationMs`

Check backend ECS / CloudWatch logs for `CacheClearService` and `InternalCacheController`.
