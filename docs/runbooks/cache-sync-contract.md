# Contract: CHT catalog cache & sync refresh

Defines Redis caching on **chm-backend only** and cache invalidation when MediaHub sync completes.

**When to implement:** Phase 4 (MediaHub platform move) — document now for Hub worker + CHT backend alignment.

**Owner:** Uche Aduakaa  
**Reviewer:** Adaze Oviawe  
**Approved:** June 16, 2026 at 08:28 PM EDT  
**Status:** Draft

---

## Principles

- **CHT-only cache** — no HTTP cache in mediahub-api; no FastAPI middleware
- **4h TTL** — safety net for populated keys (`EX 14400`)
- **Refresh on sync** — clear catalog keys after successful worker sync (no version counters)
- **Never cache** — auth, payments, admin writes, HCP upsert responses

---

## Redis

| Item | Value |
| ---- | ----- |
| Cluster | **One** shared ElastiCache Redis per environment (cost + ops simplicity) |
| Isolation | **Logical key prefixes** — not separate clusters or durable DB storage |
| TTL | `EX 14400` (4 hours; override via `REDIS_CACHE_TTL_SECONDS` / `CATALOG_CLIPS_CACHE_TTL_SECONDS`) |

Nothing cached here is authoritative data (no sessions, payments, or user records). MediaHub catalog reads, Content Hub KOL/intel reads, and YouTube fallbacks are ephemeral upstream caches only.

### Key patterns

| Prefix | Content |
| --- | ------- |
| `cht:catalog:*` | YouTube playlist/channel catalog fallbacks |
| `cht:contenthub:*` | Content Hub producer reads (`/kols`, `/kols/{slug}`, publications, …) |
| `cht:kol-network:*` | Legacy prefix — cleared for backwards compatibility |

`hash(params)` = stable hash of sorted query string (Content Hub paths include this in the key).

---

## Cache clear endpoints

API reference: [internal-cache-clear.md](../api/internal-cache-clear.md)

### Internal (sync jobs + ops script)

```
POST /api/internal/cache/clear?scope=catalog|contenthub|all&cacheKey=${INTERNAL_CACHE_SECRET}
POST /api/internal/cache/clear/all?cacheKey=${INTERNAL_CACHE_SECRET}
Authorization: Bearer ${INTERNAL_CACHE_SECRET}   # optional alternative to cacheKey query param
```

Legacy alias (clears **all** upstream prefixes — used by MediaHub worker today):

```
POST /api/internal/cache/catalog/clear?cacheKey=${INTERNAL_CACHE_SECRET}
Authorization: Bearer ${INTERNAL_CACHE_SECRET}
```

Response (JSON):

```json
{
  "scope": "contenthub",
  "enabled": true,
  "deletedByPattern": { "cht:contenthub:*": 12, "cht:kol-network:*": 0 },
  "total": 12,
  "durationMs": 45
}
```

**Manual from laptop:**

```bash
INTERNAL_CACHE_SECRET=... ./scripts/clear-upstream-cache.sh dev contenthub
```

After Content Hub KOL or AI brief updates, use `scope=contenthub`. After MediaHub sync, use `scope=all` (or legacy `catalog/clear`).

### Security

Stored in AWS Secrets Manager app JSON key **`internal_cache_secret`** (Terraform `internal_cache_secret` in `dev.tfvars` / `platform.tfvars`).

Same value on:
- CHT backend ECS → env `INTERNAL_CACHE_SECRET`
- Content Hub Lambda → env `INTERNAL_CACHE_SECRET`
- Manual: `INTERNAL_CACHE_SECRET=... ./scripts/clear-upstream-cache.sh dev contenthub`

Generate: `openssl rand -hex 32`

```
mediahub-worker completes successful sync
    → POST https://<chm-backend>/api/internal/cache/catalog/clear
    → Header: Authorization: Bearer <INTERNAL_CACHE_SECRET>
    → chm-backend deletes keys matching cht:catalog:*, cht:contenthub:*, cht:kol-network:*
    → Next user request = cache miss → fetch upstream → store 4h
```

Content Hub ingest (KOL intel / AI brief):

```
contenthub-worker completes KOL enrichment
    → POST .../api/internal/cache/clear?scope=contenthub
```

### Security

Shared secret in Secrets Manager or ECS env (`INTERNAL_CACHE_SECRET`). Content Hub Lambda and ops scripts use this — not admin login.

### Worker hook (MediaHub)

Call CHT clear endpoint **only after** sync transaction commits successfully. Do not call on failed sync.

---

## Implementation checklist

**CHT backend:**

- [ ] Redis client + cache wrapper on catalog/KOL services
- [ ] Internal clear endpoint + guard
- [ ] `INTERNAL_CACHE_SECRET` in Secrets Manager

**mediahub-worker:**

- [ ] `CHT_CACHE_CLEAR_URL` + secret env vars
- [ ] HTTP POST on sync success
- [ ] Log success/failure (non-blocking — TTL still expires stale data)

---

## Testing

| Scenario | Expected |
| -------- | -------- |
| Cache miss | Hub called; key set with 4h TTL |
| Cache hit | Hub not called |
| After sync clear | Next request cache miss; new clips visible |
| Failed sync | Cache **not** cleared |
| Invalid secret on clear | 401; cache unchanged |

---

## Related

- [CHM-Platform-Roadmap-Plan.md](../reports/CHM-Platform-Roadmap-Plan.md) — CHT-only cache strategy
- [mediahub-platform-cutover.md](./mediahub-platform-cutover.md)
