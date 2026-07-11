# CHT WordPress-as-CMS Plan
### Architecture, endpoints, mu-plugin updates, content flow, timeline
**Date:** July 11, 2026 (v2, incorporates live investigation of `communityhealth.media` at 100-post sample size)
**Author:** Sébastien Frégeau
**Audience:** Uche and the CHT frontend team
**Predecessor:** `cht-wordpress-cms-integration-2026-07-10.md` (superseded).

---

## Summary

CHT (`testapp.communityhealth.media`) becomes an editorial-driven video site. Every video on CHT is a WordPress post on `communityhealth.media`, embedded via YouTube iframe (same as WordPress does today), enriched with ContentHub-produced data (tags, AI summaries, engagement stats, doctor names). If a video isn't on WordPress, it doesn't appear on CHT.

The read pattern is a **single call**: CHT hits `GET /api/public/clips` and receives clips with a `wordpress: {...} | null` field inline. When populated, the clip is on WordPress and should render. When null, the clip is not editorial and CHT filters it out (or ContentHub filters via `?has_wordpress=true`).

No self-hosted video. YouTube stays the video source. ContentHub owns the join between Clip and WordPress post; CHT never has to think about it.

---

## Full content flow: WordPress save → CHT display

This is the end-to-end path from the editorial team publishing a video post on `wp-admin` to a user seeing that video on CHT.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: EDITORIAL AUTHORING                                              │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Editor opens wp-admin at communityhealth.media/wp-admin.                   │
│  Adds new post (or edits existing). Post consists of:                       │
│    • Title (visible in WordPress + used by SEO)                            │
│    • Content: a Gutenberg block containing a YouTube iframe embed          │
│      (the wp-block-embed with is-provider-youtube class)                    │
│    • Categories: from the 34-slot disease-state taxonomy                    │
│      (her2, mbc, hr, high-risk-cns, ebc, asco-2026, enhertu, etc.)         │
│    • Tags: drug/trial/detail granularity                                    │
│    • Series: doctor pairing (bardia-callahan, rugo-shatsky, etc.)          │
│    • Format: video (for embedded content) or standard (livestreams)         │
│    • Featured media: thumbnail image                                        │
│                                                                            │
│  Clicks Publish (or Update).                                                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  STAGE 2: WP MU-PLUGIN FIRES WEBHOOK                                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  cht-webhook.php (must-use plugin, already installed) fires on the         │
│  transition_post_status / post_updated / before_delete_post hook.           │
│                                                                            │
│  Assembles payload (JSON):                                                  │
│    event: "published" | "updated" | "deleted"                              │
│    post_id: integer                                                         │
│    post_type: "post"                                                        │
│    slug: string (from post_name)                                            │
│    title: string                                                            │
│    status: "publish"                                                        │
│    modified_gmt: ISO8601                                                    │
│    permalink: full URL on communityhealth.media                             │
│    site_url: https://communityhealth.media                                  │
│    categories: [string] — WordPress category slugs (VERBATIM, includes     │
│                p-*/hp-* variants if present)                                │
│    tags: [string] — WordPress tag slugs                                     │
│    series: [string] — WordPress series slugs (doctor pairings) [NEW]       │
│    format: string — "video" or "standard" [NEW]                            │
│    youtube_video_id: string | null — 11-char YouTube ID [NEW]              │
│                       extracted from post_content via PHP regex             │
│    featured_media_url: string | null — thumbnail URL [NEW]                  │
│                                                                            │
│  Signs body: X-CHT-Signature: sha256=<HMAC of body using shared secret>    │
│  POSTs fire-and-forget (blocking=false) to:                                 │
│    https://contenthub.communityhealth.media/api/wordpress/webhook           │
│                                                                            │
│  On WordPress side: editor sees no lag. If ContentHub is down, no impact.  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  STAGE 3: CONTENTHUB WEBHOOK RECEIVES + ENQUEUES                           │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ECS API endpoint POST /api/wordpress/webhook:                             │
│    1. Verifies HMAC-SHA256 signature (constant-time compare)                │
│    2. Shape check (required fields, event enum valid)                       │
│    3. Enqueues raw payload to SQS queue:                                    │
│         contenthub-sync-wordpress-ingest-queue                             │
│    4. Returns 200 {"accepted":true,"enqueued":true}                         │
│                                                                            │
│  DLQ backs the main queue with 3-retry policy. CloudWatch alarms armed     │
│  on DLQ depth and Lambda error rate.                                       │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  STAGE 4: LAMBDA CONSUMES + INSERTS INTO RDS                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  contenthub-sync-wordpress-ingest Lambda (Python 3.12):                    │
│    - SQS event source mapping, batch size 1                                 │
│    - Parses payload                                                         │
│    - INSERT INTO wordpress_events (                                        │
│        post_id, modified_gmt, event, slug, title, permalink,              │
│        status, categories, tags, series, format,                           │
│        youtube_video_id, featured_media_url,                              │
│        raw_payload (JSONB)                                                 │
│      )                                                                     │
│    - UNIQUE constraint on (post_id, modified_gmt) provides idempotency    │
│    - Deleted events: same insert, event='deleted' — endpoint filters these│
│                                                                            │
│  All events land, including format=standard (livestream announcements).    │
│  format=standard rows just never join to a Clip because they lack           │
│  youtube_video_id.                                                          │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  STAGE 5: CHT REQUESTS ENRICHED CLIP DATA                                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  When a user visits testapp.communityhealth.media/catalog (or a landing    │
│  page like /catalog/her2), CHT's NestJS backend calls:                     │
│                                                                            │
│    GET https://contenthub.communityhealth.media/api/public/clips           │
│         ?has_wordpress=true                                                 │
│         &tag=biomarker:HER2+   (or whatever filter maps to the WP category)│
│         &limit=50                                                           │
│    Headers:                                                                 │
│      X-API-Key: <PROD_PUBLIC_API_KEY>                                      │
│                                                                            │
│  Cache: CHT's read layer caches the response for 5 minutes per query key.  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  STAGE 6: CONTENTHUB JOINS + RETURNS                                       │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ContentHub's endpoint /api/public/clips:                                  │
│    Base query: SELECT * FROM clips WHERE channel='chm-official'            │
│    LEFT JOIN LATERAL (                                                      │
│      SELECT * FROM wordpress_events we                                     │
│      WHERE we.youtube_video_id = split_part(clip.id, ':', 3)              │
│        AND we.event != 'deleted'                                            │
│      ORDER BY we.modified_gmt DESC                                          │
│      LIMIT 1                                                                │
│    ) wordpress ON true                                                      │
│    WHERE (has_wordpress='true' → wordpress.post_id IS NOT NULL)            │
│                                                                            │
│  Response: array of PublicClip objects, each with a `wordpress: {...}|null`│
│  field. Server-side filtering means CHT doesn't ever see non-editorial     │
│  clips when has_wordpress=true is set.                                     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  STAGE 7: CHT RENDERS THE PAGE                                             │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Landing page (/catalog/:diseaseSlug) — e.g., /catalog/her2:               │
│    • Backend filters clips where wordpress.categories includes 'her2'     │
│    • Each card renders from:                                              │
│        clip.title, clip.thumbnail_url, clip.ai_summary (truncated),        │
│        clip.doctors, clip.view_count, wordpress.series[0]                 │
│    • Card URL: /catalog/clip/<clip.id> (already CHT's existing scheme)    │
│                                                                            │
│  Clip detail page (/catalog/clip/:id):                                     │
│    • Hero: YouTube iframe embed (from clip.youtube_url)                    │
│    • Title: clip.title                                                     │
│    • Summary: clip.ai_summary (full)                                       │
│    • Tags: clip.tags (namespaced) rendered as pills                       │
│    • Doctors: clip.doctors                                                 │
│    • Engagement: clip.view_count / like_count / comment_count             │
│    • Series pill: wordpress.series[0] if present                          │
│    • Canonical URL for SEO: <link rel="canonical" href={wordpress.permalink}>│
│                                                                            │
│  User plays video: YouTube iframe loads from Google CDN, tracked by       │
│  YouTube's own analytics. CHT doesn't proxy or cache the video itself.    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Design principles

- **CHT clones the WordPress structural pattern.** YouTube iframe embed for the video hero, ContentHub metadata (tags, AI summary, engagement counts, doctors, series) overlaid on the page. No self-hosted video. No custom player.
- **One HTTP call to render a page.** ContentHub does the WP↔Clip join server-side. CHT's `/api/public/clips` response carries a `wordpress: {...} | null` field inline. No separate WordPress endpoint for the primary catalog path, no client-side join.
- **Store WordPress data verbatim.** Category slugs, tag slugs, series slugs pass through untouched. No normalization, stripping, or mapping. CHT decides how to render at display time.
- **Cache what ContentHub produces.** Tags, AI summaries, engagement stats, doctor names cached client-side with 5-minute TTL. YouTube handles video CDN and playback via its iframe — no CHT proxying.

---

## Live investigation findings (July 11)

Read-only authenticated pulls from `communityhealth.media/wp-json/wp/v2/` at 100-post sample size.

### F1: YouTube extraction reliability = 98%

Every video post embeds exactly one YouTube video via a `<figure class="wp-block-embed is-provider-youtube">` block containing `<iframe src="https://www.youtube.com/embed/<11-char-id>?feature=oembed">`.

- 98/100 posts had exactly 1 YouTube ID
- 0/100 had multiple YouTube IDs (clean 1:1)
- 2/100 that failed extraction have `format=standard` — livestream registration pages (Jotform embeds)

**Extraction regex** (validated against real data):
```
(?:youtube\.com/(?:embed/|watch\?v=|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})
```

### F2: WordPress `series` taxonomy (previously unknown to us)

50+ series entries, each named after a doctor pairing:

| slug | display name | posts |
|---|---|---|
| rugo-shatsky | Dr. Hope Rugo & Dr. Rebecca Shatsky | 15 |
| bardia-callahan | Dr. Aditya Bardia & Dr. Reena Callahan | 14 |
| iyengar-pegram | Dr. Neil Iyengar & Dr. Mark Pegram | 13 |
| mouabbi-kang-birhiray | Mouabbi/Kang/Birhiray | 11 |
| mouabbi-rimawi | Mouabbi/Rimawi | 10 |
| ...more... | | |

Implication: mu-plugin needs to send `series` in the payload. ContentHub stores it. It's authoritative for CHT rendering (see Q4).

### F3: WordPress category taxonomy

34 categories. Top by post count:

| slug | display name | posts | notes |
|---|---|---|---|
| mbc | mBC | 259 | metastatic |
| her2 | HER2+ | 208 | biomarker |
| hr | HR+ | 188 | biomarker |
| high-risk-cns | High-Risk / CNS | 184 | biomarker |
| p-her2 | P-Her2+ | 184 | variant of HER2+ (see below) |
| p-hr | P-HR+ | 181 | variant of HR+ |
| p-high-risk-cns | P-High-Risk / CNS | 167 | variant of High-Risk / CNS |
| asco-2026 | ASCO 2026 | 135 | conference |
| db09 | DB09 | 94 | trial |
| ebc | eBC | 85 | early breast cancer |
| enhertu | Enhertu | 82 | drug (brand name for T-DXd) |
| ...more... | | | |

**`p-*` and `hp-*` prefixes observed but unresolved.**
- `hp-*` (5 categories, all with `count=0`) — appears to be a historical, unused scheme.
- `p-*` variants co-occur with plain versions on every post sampled. Every `her2` post is ALSO tagged `p-her2`. Category landing pages exist for both (`/category/her2/` and `/category/p-her2/`) but render identically.
- Homepage HTML contains `category-p-hr` CSS class markers, suggesting `p-*` powers some homepage feed logic.

**Design decision: don't resolve or normalize.** Store all slugs verbatim. CHT decides how to render. If the editorial team later clarifies what `p-*` means, that's a rendering-side change on CHT — no ContentHub schema or data changes required.

### F4: WordPress `tags` taxonomy

50+ tag entries: drug names (`her2`, `enhertu`, `dato-dxd`, `cami`, `truqap`), trial IDs (`db09`, `db05`, `db11`, `cleopatra`, `her2climb-05`), clinical concepts (`cns`, `adjuvant`, `early-breast-cancer`), side effects (`bradycardia`, `diarrhea`, `ctdna`, `esr1`).

Higher granularity than categories. Some overlap with categories at the top (`her2` is both a category and a tag).

### F5: WordPress scale

- **500 total posts** on `communityhealth.media`
- Compare: 3,158 clips on ContentHub, of which 952 are `chm-official` channel
- WordPress covers roughly half of chm-official. The other half exists on YouTube but not on WordPress — those clips do NOT appear on CHT.

### F6: CHT's URL scheme (extracted from CHT SPA bundle)

CHT's client-side router (React Router) defines these paths for catalog rendering:

- `/catalog` — top-level catalog page
- `/catalog/:diseaseSlug` — biomarker/disease-state landing (e.g., `/catalog/her2`)
- `/catalog/clip/:id` — clip detail page
- `/catalog/playlist/:playlistId` — playlist page

**`:diseaseSlug` matches WordPress category slug directly.** So `/catalog/her2` filters to clips whose `wordpress.categories` contains `her2`. No renaming or mapping needed on CHT's side.

---

## Answers to open questions

### Q1. What does the `p-` category prefix mean?

**Best guess from data:** promoted / publisher / homepage-featured. `p-*` categories co-occur with plain versions on every video post. `hp-*` (Home Page) categories are all empty — likely a historical scheme that got replaced by `p-*`.

**Decision:** don't resolve. Store slugs verbatim. If the editorial team later clarifies what `p-*` means, that's a rendering-side change on CHT — no ContentHub schema change needed.

### Q2. CHT landing page URL scheme?

**Confirmed from CHT SPA bundle:** `/catalog/:diseaseSlug` where the slug matches WordPress category slug directly. CHT already anticipated this pattern.

**Implication:** ContentHub returns raw WP category slugs in `wordpress.categories`. CHT reads them and routes accordingly. No mapping table needed.

### Q3. How to handle posts without discoverable YouTube ID (livestreams, 2%)?

**Design:** ContentHub stores the WordPress event in `wordpress_events` with `youtube_video_id = null` and `format = 'standard'`. The LEFT JOIN on `/api/public/clips` naturally never matches (no Clip has a null-derived id), so these rows are invisible to CHT's catalog.

If CHT later needs webinar/livestream URLs, add a separate `/api/public/wordpress/webinars` endpoint that queries `wordpress_events WHERE wp_format='standard' AND status='publish'`. **Not MVP.** CHT's existing webinar workflow doesn't need this.

### Q4. WP `series` vs ContentHub `kol_groups`?

**WP `series` is authoritative** for CHT rendering. Reasons:
1. WordPress is the editorial source of truth per July 10 team decision
2. WP `series` (n=50+) is more granular than ContentHub `kol_groups` (n=26)
3. Editorial team names series in wp-admin. Editorial authority = display authority.

**In the response**, put WP series slugs in `wordpress.series` directly. CHT renders them.

ContentHub's `kol_groups` table continues to exist for internal KOL-network features (accessed via `/api/public/kols` — a separate endpoint CHT already uses). WordPress series and ContentHub kol_groups are two independent data models that happen to overlap conceptually. No backfill or reconciliation needed.

### Q5. Cache TTL?

**5 minutes MVP.** Client-side cache in CHT's NestJS backend. Editorial changes propagate within 5 min without any webhook orchestration. Cache invalidation webhook (ContentHub → CHT `/api/internal/cache/clear`) is a nice-to-have deferred.

---

## Architecture (Option B: inline `wordpress` field on Clip response)

```
                    ┌─────────────────────────────────┐
                    │  Editorial WordPress site        │
                    │  communityhealth.media          │
                    │  500 posts                      │
                    │  34 categories                   │
                    │  50+ series (doctor pairings)   │
                    └──────────┬──────────────────────┘
                               │ HMAC-signed webhook
                               │ (see Stage 2 above)
                               ▼
                    ┌─────────────────────────────────┐
                    │  ContentHub                     │
                    │  wordpress_events table         │
                    │  columns:                       │
                    │    post_id, modified_gmt        │
                    │    slug, title, permalink       │
                    │    categories[], tags[], series[]│
                    │    youtube_video_id (INDEXED)   │
                    │    wp_format                    │
                    │    featured_media_url           │
                    │    event, status                │
                    │    raw_payload (JSONB)          │
                    │                                 │
                    │  /api/public/clips              │
                    │    LEFT JOIN wordpress_events   │
                    │    ON youtube_video_id          │
                    │    = split_part(clip.id, ':', 3)│
                    │                                 │
                    │  Response: PublicClip + inline  │
                    │  wordpress: {...} | null        │
                    └──────────┬──────────────────────┘
                               │
                               │ GET /api/public/clips
                               │   ?has_wordpress=true (optional)
                               │
                               ▼
                    ┌─────────────────────────────────┐
                    │  CHT (testapp)                  │
                    │  Renders per Stage 7:           │
                    │   - YouTube iframe embed         │
                    │   - ContentHub tags/summary/etc │
                    │   - WP-driven categories        │
                    │   - Series (doctor pairing)     │
                    │  URL scheme:                    │
                    │   /catalog/:diseaseSlug         │
                    │   /catalog/clip/:id             │
                    │  Cache: 5-min TTL               │
                    └─────────────────────────────────┘
```

---

## What changes on ContentHub

### 1. Migration `0010_wordpress_events_youtube_and_series`

Add columns to `wordpress_events`:

```sql
ALTER TABLE wordpress_events
  ADD COLUMN youtube_video_id VARCHAR(20),
  ADD COLUMN wp_format VARCHAR(20),
  ADD COLUMN series_slugs TEXT[],
  ADD COLUMN featured_media_url TEXT;

CREATE INDEX ix_wordpress_events_youtube_video_id
  ON wordpress_events (youtube_video_id)
  WHERE youtube_video_id IS NOT NULL;
```

### 2. mu-plugin update (`cht-webhook.php`)

Add to the payload assembly:

```php
// Extract YouTube ID from post content
function cht_extract_youtube_id($content) {
    if (preg_match(
        '#(?:youtube\.com/(?:embed/|watch\?v=|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})#',
        $content,
        $m
    )) {
        return $m[1];
    }
    return null;
}

// Featured image URL
$featured_media_id = get_post_thumbnail_id($post_id);
$featured_media_url = $featured_media_id
    ? wp_get_attachment_image_url($featured_media_id, 'full')
    : null;

// Add to $payload:
'youtube_video_id'   => cht_extract_youtube_id($post->post_content),
'series'             => wp_get_post_terms($post_id, 'series', ['fields' => 'slugs']),
'format'             => get_post_format($post_id) ?: 'standard',
'featured_media_url' => $featured_media_url,
```

Backward compatible: if new fields are absent, ContentHub's handler stores nulls and continues.

### 3. WordPress ingest Lambda handler update

`sync/jobs/wordpress_ingest/handler.py`:

```python
row = WordPressEvent(
    ...  # existing fields
    youtube_video_id=payload.get("youtube_video_id"),
    series_slugs=payload.get("series", []),
    wp_format=payload.get("format", "standard"),
    featured_media_url=payload.get("featured_media_url"),
)
```

Idempotency (unique `(post_id, modified_gmt)`) unchanged.

### 4. `/api/public/clips` endpoint modification

**A. New response field:**

```python
class PublicClipWordPress(BaseModel):
    post_id: int
    permalink: str
    slug: str
    categories: list[str]           # WordPress category slugs, verbatim
    tags: list[str]                 # WordPress tag slugs
    series: list[str]               # WordPress series slugs (doctor pairings)
    featured_media_url: str | None
    modified_gmt: datetime


class PublicClip(BaseModel):
    # ... all existing fields ...
    wordpress: PublicClipWordPress | None = None
```

**B. Query change:**

LEFT JOIN LATERAL against `wordpress_events` matched on `youtube_video_id`. Only the latest non-deleted event per WP post is joined. See flow diagram Stage 6 for SQL sketch.

**C. New query param:**

`has_wordpress=true` — server-side filter to only clips with a matching WP post.

### 5. Categories helper endpoint (MVP)

`GET /api/public/wordpress/categories` — returns the list of currently-live WP category slugs with post counts. CHT uses this to render biomarker navigation dynamically. Read from `wordpress_events` where `event != 'deleted'`.

Ships with the primary endpoint change. Without it, CHT would have to derive the category list from the clips response, which only surfaces categories that have at least one visible clip (fragile for empty landing pages).

**Response:**
```json
{
  "items": [
    { "slug": "her2", "post_count": 208 },
    { "slug": "mbc", "post_count": 259 },
    { "slug": "hr", "post_count": 188 }
  ],
  "total": 34
}
```

---

## What changes on CHT

### 1. Swap the base URL

Change CHT's environment variable from `mediahub.communityhealth.media/api/public` to `contenthub.communityhealth.media/api/public`. Existing calls (`/clips`, `/playlists`, `/kols`) work unchanged.

### 2. Add `has_wordpress=true` to catalog reads

```
GET /api/public/clips?has_wordpress=true&limit=50
```

Or filter client-side on `wordpress != null` — same effect.

### 3. Landing pages driven by WP category slug

`/catalog/:diseaseSlug` renders clips where `wordpress.categories.includes(diseaseSlug)`.

Example: `/catalog/her2` → shows clips where `wordpress.categories` contains `her2`. Since the editorial team also tags with `p-her2`, the CHT UI can decide whether to match `/catalog/p-her2` as a separate route or fold it into `/catalog/her2` — that's CHT's decision, no ContentHub work.

### 4. Clip detail page

`/catalog/clip/:id` renders:
- Hero: `<iframe src={clip.youtube_url}>` — YouTube iframe embed
- Summary: `clip.ai_summary`
- Tags: `clip.tags` as pills
- Doctors: `clip.doctors`
- Engagement: `clip.view_count`, `like_count`, `comment_count`
- Series: `clip.wordpress.series[0]` (rendered as pill or subtitle)
- Canonical URL for SEO: `<link rel="canonical" href={clip.wordpress.permalink}>`

### 5. Cache

5-minute TTL on all `/api/public/clips` responses. Editorial changes propagate within 5 min without extra plumbing.

---

## What we're NOT building

1. **Self-hosted video.** YouTube stays. No S3/CloudFront video work.
2. **Custom video player.** YouTube iframe stays.
3. **Separate `/api/public/wordpress` endpoint** (for clips). Inline `wordpress` field on Clip response covers it.
4. **Client-side join between clips and WP posts.** ContentHub does the join server-side.
5. **Category slug normalization or mapping.** Store verbatim. CHT decides how to render.
6. **KOL group ↔ WordPress series backfill.** Series pass-through only.
7. **HubSpot cache-invalidation webhook.** 5-min TTL is MVP.

---

## Timeline

Assuming Monday demo is fixed, plan agreed today:

| Day | Task | Owner | Estimated |
|---|---|---|---|
| Sat 7/11 (today) | This plan MD, agreement | Sebastien + Uche | done |
| Sun 7/12 | mu-plugin update on the editorial WordPress site (youtube_video_id + series + format + featured_media_url) | Sébastien | 30 min |
| Sun 7/12 | Migration 0010 + `wordpress_ingest` handler update | Sébastien | 1 hr |
| Sun 7/12 | Endpoint change: `PublicClip.wordpress` field + LEFT JOIN + `has_wordpress` param + tests | Sébastien | 3–4 hr |
| Sun 7/12 | Ship to ContentHub dev, verify shape end-to-end | Sébastien | 30 min |
| Mon 7/13 morning | Uche's team implements CHT-side against dev endpoint | Uche | half day |
| Mon 7/13 afternoon | Demo: WP-as-CMS integration on staging | Sébastien + Uche | during meeting |
| Tue 7/14 | Ship to ContentHub prod (release cycle) | Sébastien + Uche | 1 hr |
| Tue–Wed 7/14–15 | CHT staging switchover, verification | Sébastien + Uche | half day |
| Wed–Thu 7/15–16 | CHT prod switchover, coordinated w/ editorial | Uche | 1 hr |

Monday demo can show the concept working on dev even if prod switchover happens later in the week.

---

## Rollback

Any layer of this can revert independently:

- **Endpoint change breaks CHT**: CHT flips `CONTENTHUB_BASE_URL` back to MediaHub (both continue serving during transition).
- **mu-plugin fails on WordPress**: plugin has defensive no-op fallback if constants undefined; revert file to previous version, no site breakage.
- **`wordpress` field breaks a CHT deserializer**: CHT ignores the field (JSON parsers pass unknown fields; TypeScript can mark optional).
- **Category slug variant confusion (`p-*` etc.)**: since we're storing verbatim, "fix" is a CHT rendering change — no data migration.

---

## Appendix A: Worked example — one clip on the wire

**CHT calls:**
```
GET https://contenthub.communityhealth.media/api/public/clips
    ?has_wordpress=true
    &tag=biomarker:HER2+
    &limit=1
X-API-Key: <prod key>
```

**Response:**

```json
[
  {
    "id": "official:youtube:m55-LG1MBFs",
    "title": "Managing Early-Stage T-DXd Toxicities with Drs. Sarah Premji, Reshma Mahtani & Eleftherios Mamounas",
    "description": "...",
    "ai_summary": "Drs. Premji, Mahtani, and Mamounas discuss practical strategies for managing T-DXd toxicities in HER2-positive early breast cancer, including patient counseling, dose modifications, and management of ILD, nausea, and fatigue.",
    "tags": ["biomarker:HER2+", "drug:T-DXd", "doctor:Premji", "doctor:Mahtani", "doctor:Mamounas", "stage:eBC"],
    "doctors": ["Sarah Premji", "Reshma Mahtani", "Eleftherios Mamounas"],
    "thumbnail_url": "https://i.ytimg.com/vi/m55-LG1MBFs/maxresdefault.jpg",
    "youtube_url": "https://www.youtube.com/watch?v=m55-LG1MBFs",
    "duration_seconds": 340,
    "is_short": false,
    "posted_at": "2026-07-10T13:10:44Z",
    "view_count": 12500,
    "like_count": 240,
    "comment_count": 18,
    "shoot_id": "s-xxx",
    "shoot_name": "T-DXd toxicities panel",
    "wordpress": {
      "post_id": 4947,
      "permalink": "https://communityhealth.media/managing-early-stage-tdxd-toxicities-her2-positive-breast-cancer-sarah-premji-reshma-mahtani-eleftherios-mamounas/",
      "slug": "managing-early-stage-tdxd-toxicities-her2-positive-breast-cancer-sarah-premji-reshma-mahtani-eleftherios-mamounas",
      "categories": ["asco-2026"],
      "tags": [],
      "series": ["premji-mahtani-mamounas"],
      "featured_media_url": "https://communityhealth.media/wp-content/uploads/2026/07/clip-6-managing-early-stage-t-dxd-toxicities-with-drs.-sarah-premji-reshma-mahtani-eleftherios-mamounas.jpg",
      "modified_gmt": "2026-07-10T13:10:46Z"
    }
  }
]
```

CHT renders this as:
- Page URL: `/catalog/clip/official:youtube:m55-LG1MBFs`
- Hero: `<iframe src="https://www.youtube.com/embed/m55-LG1MBFs">`
- Title bar: from `title`
- Summary card: `ai_summary`
- Tag pills: `tags` (namespaced) OR `wordpress.categories` (WP slugs)
- Doctor byline: `doctors.join(', ')`
- Stats: `view_count`, `like_count`, `comment_count`
- Series subtitle: `wordpress.series[0]` → "premji-mahtani-mamounas"
- SEO: `<link rel="canonical" href={wordpress.permalink}>`

One HTTP call. Everything needed to render.

---

*Prepared July 11, 2026 by Sébastien Frégeau. All findings verified against live `communityhealth.media` REST API at 100-post sample size + inspection of CHT SPA bundle for URL scheme confirmation. Update this doc rather than layering memos when the plan shifts.*
