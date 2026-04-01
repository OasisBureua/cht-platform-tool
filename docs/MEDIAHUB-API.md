# MediaHub Public API Integration

The CHT platform integrates with the MediaHub Public API for video catalog content (clips, tags, doctors, search). When configured, MediaHub replaces YouTube as the primary catalog source.

## Configuration

**Base URL:** `https://mediahub.communityhealth.media/api/public`  
**Auth:** `X-API-Key` header on every request  
**Rate limit:** 100 requests/minute per IP  
**CORS:** Configured for communityhealth.media, testapp.communityhealth.media, localhost

### Environment Variables

```bash
MEDIAHUB_BASE_URL=https://mediahub.communityhealth.media/api/public
MEDIAHUB_API_KEY=your_api_key
```

### Terraform (platform.tfvars)

```hcl
mediahub_api_key = "your_api_key"
```

## Backend Endpoints (Proxy)

The backend proxies MediaHub and keeps the API key server-side. All requests go through the CHT backend:

| Endpoint | Description |
|----------|-------------|
| `GET /api/catalog` | Catalog items (MediaHub clips when configured, else YouTube/DB) |
| `GET /api/catalog/tags` | All tags grouped by category |
| `GET /api/catalog/clips` | Video catalog with filters |
| `GET /api/catalog/clips/:id` | Single clip detail |
| `GET /api/catalog/doctors` | Doctor profiles |
| `GET /api/catalog/doctors/:slug` | Doctor detail with clips |
| `GET /api/catalog/search?q=` | Full-text search |

### Clips Query Params

- `q` – Text search
- `tag` – Comma-separated tags (AND logic)
- `doctor` – Filter by doctor
- `platform` – Filter by platform
- `sort_by` – `views` \| `likes` \| `recent` \| `posted`
- `limit`, `offset` – Pagination

## Clip Response Shape

Upstream **`GET /api/public/clips`** (list) and **`GET /api/public/clips/{id}`** (detail) return the same clip object shape. The CHT backend proxies these at **`GET /api/catalog/clips`** and **`GET /api/catalog/clips/:id`** and forwards the JSON as-is (snake_case field names).

- **`description`** – Long-form text (e.g. YouTube description).
- **`ai_summary`** – Short editorial / AI summary for cards and the clip detail **Summary** section. The app prefers this over `description` when present and not boilerplate refusal text.

```json
{
  "id": "official:youtube:E1tTwDQgMBc",
  "title": "Dr. Aditya Bardia and Dr. Reena Callahan - Redefining HER2...",
  "description": "In this insightful CHM Conversations episode... [long YouTube description]",
  "ai_summary": "Drs. Bardia and Callahan examine the evolving HER2 classification framework...",
  "tags": ["doctor:Bardia", "biomarker:HER2", "..."],
  "doctors": ["Bardia", "Callahan"],
  "thumbnail_url": "https://i.ytimg.com/vi/E1tTwDQgMBc/hqdefault.jpg",
  "youtube_url": "https://www.youtube.com/watch?v=E1tTwDQgMBc",
  "duration_seconds": 342,
  "is_short": false,
  "posted_at": "2025-11-15T00:00:00",
  "view_count": 1250,
  "like_count": 45,
  "comment_count": 3,
  "shoot_id": "shoot_abc",
  "shoot_name": "Optional shoot label"
}
```

## Embed URLs

- **Watch:** `https://www.youtube.com/watch?v=VIDEO_ID`
- **Embed:** `https://www.youtube.com/embed/VIDEO_ID`

## Fallback Order

1. **MediaHub** (when `MEDIAHUB_API_KEY` is set)
2. **YouTube** (when `YOUTUBE_API_KEY` and `YOUTUBE_PLAYLIST_IDS` are set)
3. **Database programs** (always available)
