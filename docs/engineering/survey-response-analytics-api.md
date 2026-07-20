# Survey Response Analytics — API Contract

**Status:** Stable (backend implemented; frontend chart work is a separate story)
**Audience:** CHT admin UI (survey analytics charts), CHT platform backend
**Source of truth:**
- Response DTO — `backend/src/modules/admin/dto/survey-analytics.dto.ts`
- Aggregator (pure) — `backend/src/utils/survey-analytics.ts`
- Service — `backend/src/modules/surveys/surveys.service.ts` (`getResponseAnalyticsForAdmin`)
- Controller — `backend/src/modules/admin/admin.controller.ts` (`getSurveyAnalytics`)

---

## Endpoint

```
GET /api/admin/surveys/:id/analytics
```

- **Auth:** admin session (`JwtAuthGuard` + `RolesGuard`, `@Roles(ADMIN)`, `session-token` bearer). Non-admins get `403`.
- **404:** unknown survey id.
- **Aggregation:** computed on demand from stored `SurveyResponse` rows; no caching. Payload scales with number of questions × responses (and × segments when `segmentBy` is set) — surveys are small, so this is fine.

### Query parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `includeSamples` | `"1" \| "true"` | off | Include redacted free-text sample answers. Off = counts only. See [PII rules](#pii--free-text-rules). |
| `segmentBy` | `specialty \| status \| attendance` | (none) | Also return a per-segment breakdown grouped by this dimension. Invalid/absent → `segments: null`. |

---

## Response shape

Top level:

```ts
{
  survey: SurveyAnalyticsSummary;
  analytics: SurveyResponseAnalytics;
}
```

### `survey` — summary

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | |
| `title` | `string` | |
| `type` | `INTAKE \| PRE_TEST \| POST_TEST \| FEEDBACK` | Survey type enum. |
| `program` | `{ id, title } \| null` | Owning program, if any. |

### `analytics`

| Field | Type | Notes |
|-------|------|-------|
| `surveyType` | `string` | Mirror of `survey.type`. |
| `hasNativeSchema` | `boolean` | `false` for Jotform-sourced / empty schemas (questions are then inferred). |
| `totals` | `SurveyAnalyticsTotals` | See below. |
| `timeSeries` | `TimeSeriesPoint[]` | Daily response counts. |
| `questions` | `QuestionAnalytics[]` | Per-question aggregates, discriminated by `kind`. |
| `segments` | `SurveySegmentBreakdown \| null` | Present only when `segmentBy` was provided. |

#### `totals`

| Field | Type | Notes |
|-------|------|-------|
| `totalResponses` | `number` | Raw response row count. |
| `uniqueRespondents` | `number` | Distinct by `userId`; anonymous rows each count once. |
| `firstResponseAt` | `string \| null` | ISO timestamp of earliest response. |
| `lastResponseAt` | `string \| null` | ISO timestamp of latest response. |
| `completionRate` | `{ eligible, completed, rate } \| null` | `null` for `INTAKE` and program-less surveys. `rate` = `completed / eligible * 100`. `eligible` = APPROVED program registrations; `completed` = `uniqueRespondents`. |
| `score` | `NumericStats \| null` | Response-level score summary (test surveys); `null` when no numeric scores exist. |

#### `timeSeries[]`

| Field | Type | Notes |
|-------|------|-------|
| `date` | `string` | UTC day, `YYYY-MM-DD`. |
| `count` | `number` | Responses on that day. |

Ordered ascending. **Only days with responses appear** — gaps are not filled. Charts that need continuous axes should fill missing days client-side.

#### `questions[]` — discriminated by `kind`

All questions share:

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Question id (or answer key for inferred questions). |
| `prompt` | `string` | Question text (falls back to `id`). |
| `type` | `string` | Native schema type, or `"unknown"` for inferred keys. |
| `kind` | `choice \| rating \| text` | Aggregate discriminator — **switch on this**. |
| `inferred` | `boolean?` | `true` when the aggregate was inferred from data (no native type). |

**`kind: "choice"`** (single/multi choice, or inferred low-cardinality)

| Field | Type | Notes |
|-------|------|-------|
| `multiSelect` | `boolean` | `true` for multi-choice (array answers). |
| `maxSelections` | `number?` | Max selectable options (multi only), when declared. |
| `totalAnswered` | `number` | Responses that answered this question. |
| `options` | `{ label, count, percentage }[]` | Declared options render even at `count: 0`. |

- `percentage` is the **share of respondents who answered** (0–100). For multi-select, per-option percentages **can sum to more than 100%**.

**`kind: "rating"`** (rating/scale/number, or inferred numeric) — extends `NumericStats`:

| Field | Type | Notes |
|-------|------|-------|
| `count` | `number` | Numeric answers. |
| `mean` | `number \| null` | Rounded to 2 dp. |
| `median` | `number \| null` | Average of two middle values for even counts. |
| `min` / `max` | `number \| null` | |
| `histogram` | `{ value, count }[]` | Distinct values ascending. |

**`kind: "text"`** (text/long_text, or inferred high-cardinality)

| Field | Type | Notes |
|-------|------|-------|
| `responseCount` | `number` | Non-empty free-text answers. |
| `samples` | `string[]` | Empty unless `includeSamples=1`. See [PII rules](#pii--free-text-rules). |

Notes:
- `info` (display-only) questions are **excluded** from `questions`.
- Native schema questions come first (in schema order), then any extra/drift answer keys not in the schema, appended sorted by key and flagged `inferred: true`.

#### `segments` — cross-cut breakdown

Present only when `segmentBy` was provided; otherwise `null`.

```ts
{
  dimension: 'specialty' | 'status' | 'attendance';
  groups: Array<{
    key: string;            // raw value; 'unknown' when missing/empty
    label: string;          // display label; 'Unknown' for the missing bucket
    totalResponses: number;
    questions: QuestionAnalytics[]; // same shape as top-level
  }>;
}
```

- Groups are sorted by `totalResponses` descending, then `key` ascending.
- Missing/empty dimension values are bucketed under `key: 'unknown'` / `label: 'Unknown'`.
- **Segment groups are always counts-only** — `text` questions inside a group never carry `samples`, regardless of `includeSamples`.

---

## PII / free-text rules

- Identity fields (`email`, `name`, `first_name`, `user_id`, `program_id`, …) are **stripped from answers before aggregation** and never appear as questions or samples.
- `samples` are **opt-in** (`includeSamples=1`), only produced for author-declared `text`/`long_text` questions, **de-duplicated**, length-truncated (~200 chars), and count-capped.
- Email and phone values inside samples are redacted (`[redacted-email]`, `[redacted-phone]`).
- **Limitation:** an identity *value* typed inline in prose (e.g. a name inside a sentence) cannot be reliably scrubbed — which is why samples are opt-in and never emitted inside segment groups.

---

## Frontend consumption guidance

| `kind` | Suggested chart |
|--------|-----------------|
| `choice` | Bar chart of `options` (`label` → `count` or `percentage`). Show `maxSelections` and note multi can exceed 100%. |
| `rating` | Histogram from `histogram[]`; surface `mean` / `median` / `min` / `max` as summary stats. |
| `text` | Show `responseCount`; render `samples` as a quote list only when requested (admin-triggered `includeSamples`). |

- Drive rendering off `kind` (not `type`) so inferred/Jotform surveys chart the same way.
- For `timeSeries`, fill missing days client-side if a continuous x-axis is needed.
- For segmented views, request `segmentBy` and render grouped/stacked variants of the same per-question charts using each group's `questions`. Use `group.label` for the series legend and `group.totalResponses` for context.
- Guard against `completionRate: null` (INTAKE / program-less) and `score: null` (non-test surveys).

---

## Example

`GET /api/admin/surveys/sv_123/analytics?segmentBy=specialty`

```json
{
  "survey": {
    "id": "sv_123",
    "title": "Post-event feedback",
    "type": "FEEDBACK",
    "program": { "id": "prog_1", "title": "Cardiometabolic Series" }
  },
  "analytics": {
    "surveyType": "FEEDBACK",
    "hasNativeSchema": true,
    "totals": {
      "totalResponses": 3,
      "uniqueRespondents": 3,
      "firstResponseAt": "2026-07-10T09:00:00.000Z",
      "lastResponseAt": "2026-07-11T11:00:00.000Z",
      "completionRate": { "eligible": 4, "completed": 3, "rate": 75 },
      "score": null
    },
    "timeSeries": [
      { "date": "2026-07-10", "count": 2 },
      { "date": "2026-07-11", "count": 1 }
    ],
    "questions": [
      {
        "id": "role",
        "prompt": "Your role?",
        "type": "single_choice",
        "kind": "choice",
        "multiSelect": false,
        "totalAnswered": 3,
        "options": [
          { "label": "MD", "count": 2, "percentage": 66.7 },
          { "label": "NP", "count": 1, "percentage": 33.3 },
          { "label": "PA", "count": 0, "percentage": 0 }
        ]
      },
      {
        "id": "confidence",
        "prompt": "Confidence (1-5)",
        "type": "rating",
        "kind": "rating",
        "count": 3,
        "mean": 3.67,
        "median": 4,
        "min": 2,
        "max": 5,
        "histogram": [
          { "value": 2, "count": 1 },
          { "value": 4, "count": 1 },
          { "value": 5, "count": 1 }
        ]
      },
      {
        "id": "comments",
        "prompt": "Anything else?",
        "type": "long_text",
        "kind": "text",
        "responseCount": 3,
        "samples": []
      }
    ],
    "segments": {
      "dimension": "specialty",
      "groups": [
        {
          "key": "Cardiology",
          "label": "Cardiology",
          "totalResponses": 2,
          "questions": [
            {
              "id": "role",
              "prompt": "Your role?",
              "type": "single_choice",
              "kind": "choice",
              "multiSelect": false,
              "totalAnswered": 2,
              "options": [
                { "label": "MD", "count": 1, "percentage": 50 },
                { "label": "NP", "count": 1, "percentage": 50 },
                { "label": "PA", "count": 0, "percentage": 0 }
              ]
            }
          ]
        },
        {
          "key": "Oncology",
          "label": "Oncology",
          "totalResponses": 1,
          "questions": [
            {
              "id": "role",
              "prompt": "Your role?",
              "type": "single_choice",
              "kind": "choice",
              "multiSelect": false,
              "totalAnswered": 1,
              "options": [
                { "label": "MD", "count": 1, "percentage": 100 },
                { "label": "NP", "count": 0, "percentage": 0 },
                { "label": "PA", "count": 0, "percentage": 0 }
              ]
            }
          ]
        }
      ]
    }
  }
}
```
