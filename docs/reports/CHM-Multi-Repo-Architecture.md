# Community Health Media — Multi-Repo Architecture Report

**Generated:** 2026-10-20  
**Source:** Local clones under `/Users/ucheaduaka/Documents`, analyzed from each repo’s **`develop`** branch (read-only via git; working trees were not modified).  
**Repos covered:** Four primary product/service repos, plus a short note on supporting util Lambdas also present locally.

| Repo | Local path | Branch analyzed | Origin |
|------|------------|-----------------|--------|
| cht-platform-tool | `…/cht-platform-tool` | `develop` | `OasisBureua/cht-platform-tool` |
| cht-content-hub | `…/cht-content-hub` | `develop` | `OasisBureua/cht-content-hub` |
| cht-reports | `…/cht-reports` | `develop` | `OasisBureua/cht-reports` |
| cht-companion | `…/cht-companion` | `develop` | `OasisBureua/cht-companion` |
| cht-util-lambdas *(supporting)* | `…/cht-util-lambdas` | `develop` | `OasisBureua/cht-util-lambdas` |

---

## System overview

```
                         ┌─────────────────────────────────────┐
                         │  Members / Admins (React SPA)       │
                         │  app / testapp / devapp.*.media     │
                         └─────────────────┬───────────────────┘
                                           │
                         ┌─────────────────▼───────────────────┐
                         │  cht-platform-tool (NestJS BFF)     │
                         │  RDS Prisma · Redis · SQS worker    │
                         └───┬─────────────┬─────────────┬─────┘
                             │             │             │
              Cognito M2M    │   Service   │  DynamoDB+  │
                             │   Connect   │  SQS        │
              ┌──────────────▼──┐  ┌───────▼──────┐  ┌──▼──────────────┐
              │ cht-content-hub │  │ cht-companion│  │ cht-reports     │
              │ FastAPI + Aurora│  │ FastAPI RAG  │  │ NestJS worker   │
              │ catalog/KOL/    │  │ + /generate  │  │ PDF → S3        │
              │ report warehouse│  │ pgvector     │  │ DDB job state   │
              └────────┬────────┘  └──────▲───────┘  └────────┬────────┘
                       │                  │                   │
                       │   report-packet  │  Bedrock LLM      │
                       └──────────────────┴───────────────────┘
```

**Shared infrastructure themes:** Cognito (user pools + M2M clients/scopes), ECS Fargate (often shared platform cluster + Service Connect), Secrets Manager, GitHub Actions → Terraform deploys, domains under `*.communityhealth.media`.

**Shared product IDs:** Hub `campaigns.id` ↔ Platform `Program.campaignId`; Platform `Program.id` ↔ Hub export/reports warehouse `platform_tool_program_id`.

---

## 1. cht-platform-tool

### What it does
Primary Community Health product for KOLs, HCPs, and ops/admins. Hosts the React SPA and NestJS API: live CME (Zoom webinars / office hours), registration & attendance, native surveys, Stripe Connect honoraria, admin Program Hub, catalog/KOL UI (data from Content Hub), Companion chat BFF, and report-generation orchestration (enqueue DynamoDB + SQS for `cht-reports`).

### Stack
| Layer | Tech |
|-------|------|
| Backend | NestJS 11, TypeScript, Prisma 5, PostgreSQL, Redis, Passport/Cognito |
| Frontend | React 19, Vite, Tailwind, React Query, Stripe Connect JS |
| Worker | Python (SQS: payments/email/CME helpers) |
| Infra | Terraform → ECS, RDS, SQS, S3+CloudFront, ALB |

### Architecture (high level)
```
Browser → CloudFront/S3 (React)
       → ALB → NestJS (ECS)
                 → RDS (Prisma)
                 → Redis (catalog cache)
                 → SQS → Python worker
                 → Content Hub HTTP (M2M)
                 → Companion Service Connect (chat SSE)
                 → Reports DDB/SQS/S3 + internal notify callback
```

Notable Nest modules: `admin`, `programs`, `webinars`, `surveys`, `payments`, `catalog`, `content-hub`, `companion`, `reports`, `kol-network`, `zoom-recordings`, `export`.

### External integrations
Zoom (S2S OAuth, webhooks, Meeting SDK, recordings/attendance), Stripe Connect, Cognito, SES, Content Hub, Companion, Reports resources, YouTube (podcasts), NPI registry, reCAPTCHA, HubSpot (legacy/module), AppConfig flags. JotForm largely historical (native surveys preferred).

### Database schema (PostgreSQL / Prisma)

**Datasource:** `DATABASE_URL` → PostgreSQL. Migrations under `backend/prisma/migrations/` (initial `20251221` through late 2026, including survey drafts, terms, companion chat history, public registration, `SUPER_ADMIN`).

#### Enums
- `UserRole`: `HCP`, `KOL`, `ADMIN`, `SUPER_ADMIN`
- `UserStatus`: `ACTIVE`, `INACTIVE`, `SUSPENDED`
- `ProgramStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `ProgramZoomSessionType`: `WEBINAR`, `MEETING`
- `ProgramRegistrationStatus`: `SURVEY_SUBMITTED`, `PENDING`, `APPROVED`, `REJECTED`, `WAITLISTED`
- `PostEventAttendanceStatus`: `NOT_REQUIRED`, `PENDING_VERIFICATION`, `VERIFIED`, `DENIED`
- `SurveyType`: `PRE_TEST`, `POST_TEST`, `FEEDBACK`, `INTAKE`
- `PaymentType`: `HONORARIUM`, `CME_COMPLETION`, `SURVEY_BONUS`, `REFERRAL`
- `PaymentStatus`: `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `CANCELLED`
- `PreferredPaymentMethod` / `PaymentDeliveryMethod`: `ACH`, `CHECK`
- Zoom recording / sync / attendance import status enums; `WebinarParticipantEventSource`: `WEBHOOK`, `MEETING_SDK`, `REPORT_IMPORT`

#### Core models & relations
| Model | Role |
|-------|------|
| **User** | Center; Stripe Connect fields; role/status; enrollments, registrations, payments, surveys, companion conversations |
| **Session** | App session cookie store |
| **Program** | Live/on-demand session; Zoom IDs/URLs; optional `campaignId` → Hub |
| **ProgramRegistration** | Approval + post-event attendance / survey / honorarium stamps |
| **OfficeHoursSlot**, **ProgramFormLink** | Slot booking; form/survey links |
| **ProgramEnrollment**, **Video**, **VideoView** | On-demand progress |
| **Survey**, **SurveyResponse** | Native JSON Q&A (`isDraft` supported) |
| **Payment**, **CMECredit** | Honorarium + certificates |
| **WebinarParticipantEvent** | Join/leave (+ `rawPayload`) |
| **ZoomRecording\***, **ZoomAttendance\*** | Recording catalog & attendance imports |
| **AnalyticsEvent**, **AdminAuditLog** | Telemetry / audit |
| **KolDirectoryVisibility** | Public/app visibility by slug |
| **RegistrationInvite**, **PublicRegistration** | Invites + public intake |
| **CompanionConversation**, **CompanionMessage** | Chat history (citations JSON) — owned here, not in companion DB |

Report **job state is not in Prisma** — DynamoDB owned by `cht-reports`.

### How it connects to other repos
| Peer | Connection |
|------|------------|
| content-hub | Outbound M2M to `/api/public` & admin; inbound cache clear; Hub pulls Platform export (`platform/export.read`) |
| companion | BFF `POST /api/chat` → Service Connect `cht-companion:8080` |
| reports | Creates DDB item + SQS message; receives `POST /api/internal/reports/:id/ready` |

### Config themes (no secrets)
`DATABASE_URL`, Cognito pool/client + M2M, `CONTENTHUB_*`, `COMPANION_BASE_URL`, `REPORTS_*` (table/queue/bucket), Stripe, Zoom, SES, SQS, Redis, session TTLs, `INTERNAL_CACHE_SECRET`. Frontend: `VITE_API_URL`, Cognito Vite vars.

---

## 2. cht-content-hub

### What it does
AWS-native **content producer** (MediaHub replacement): clips/catalog, KOL directory, HCP intel, WordPress projection, campaigns, Platform Zoom **export warehouse**, and the **`reports.*` warehouse** that builds report packets for `cht-reports`. Headless FastAPI — no member SPA (UI stays in platform-tool).

### Stack
Python 3.11, FastAPI, SQLAlchemy async + Alembic, asyncpg, PyJWT, boto3. Workers: ECS APScheduler + EventBridge/Lambda sync jobs. Terraform: ECS API/worker, RDS (dev) / Aurora Global (prod), Cognito M2M, SQS, S3 assets.

### Architecture (high level)
```
Platform NestJS ──M2M──► contenthub-api (ECS)
                           └── Producer Aurora/RDS (separate from Platform DB)
EventBridge/Lambda ── sync, tagging, WP, export ingest, HCP intel
Hub ──► Platform cache clear
Reports ──► GET /api/campaigns/{id}/report-packet
Hub ──► Platform export API (Zoom/survey/attendance packets)
```

Domains: `devhub.communityhealth.media` / `contenthub.communityhealth.media`.

### External integrations
WordPress, YouTube / LinkedIn Ads (campaign metrics), HCP intel sources (PubMed, OpenAlex, ClinicalTrials, etc.), Cognito M2M, Platform export + cache-clear, S3 assets.

### Database schemas (PostgreSQL / Alembic)

**No Prisma.** Alembic revisions under Hub migrations (`0001`–`0031` era on `develop`). Local DB often on port **5433**.

#### Public / catalog (selected)
| Table | Notes |
|-------|--------|
| **clips** | Status/content/media enums; tags; curator overrides; FK shoots |
| **posts**, **shoots**, **projects**, **clients**, **users** | Studio/ops lineage |
| **kols**, **kol_groups**, **kol_group_members** | Directory; NPI link; publications JSON |
| **playlist_tags**, WP projection tables | Tagging / WordPress |
| **campaigns**, **campaign_kols**, **campaign_platform_data**, **platform_sync_runs** | Campaign admin; links to Platform programs |
| **report_templates** (thin public) | Template pointers for campaigns |

#### Export warehouse (`export_*`, CPR-13)
`export_sessions` (unique `platform_tool_program_id`), `export_attendance_events`, `export_registrations`, `export_survey_responses`, `export_ingest_runs`.

#### Reports warehouse (**schema `reports`**)
`campaign_groups`, `programs`, `sessions`, `clips`, `survey_responses`, `qa_entries`, `attendance`, analytics tables, `market_events`, `sponsor_sov`, `report_templates`, `reports`, `ingest_jobs`. Fed by export ingest + campaign metadata; **consumed by** report-packet API.

#### HCP Intel
`hcps` (PK `npi`), feed sources/items, signals, Rx volumes, Open Payments, NIH grants, AI briefs, etc.

### How it connects to other repos
| Peer | Connection |
|------|------------|
| platform-tool | Serves catalog; pulls export; cache-clear callback; shared `campaignId` |
| reports | Report-packet source of truth |
| companion | Indirect (catalog clips as KB source type) |

### Config themes
`DATABASE_URL`, Hub M2M / legacy API keys, `PLATFORM_EXPORT_*`, WordPress webhook/queue, HCP intel queues, `ASSETS_BUCKET`, LinkedIn/YouTube keys.

---

## 3. cht-reports

### What it does
On-demand **report generation worker** (executive summary and related templates). Pulls a Content Hub report packet, calls Companion `/generate` (Claude, no RAG), renders HTML→PDF (Chromium), writes versioned artifacts to S3, updates DynamoDB job state, notifies Platform to email stakeholders. No member-facing UI / public ALB (health only).

### Stack
NestJS 11, TypeScript, AWS SDK (DynamoDB, S3, SQS), puppeteer-core. Terraform: DynamoDB, S3, SQS, ECS on **shared platform cluster** + Service Connect.

### Architecture (high level)
```
Platform (admin JWT) → PutItem DDB + SQS { reportId }
  → ECS cht-reports
       → Hub GET …/report-packet (M2M hub/reports.read)
       → Companion POST /generate (X-BFF-Auth)
       → S3 reports/{campaignId}/{reportId}/vN.pdf
       → UpdateItem DDB
       → Platform POST …/internal/reports/{id}/ready (M2M)
```

### External integrations
Content Hub, Companion, Platform notify API, Cognito M2M, Bedrock (via Companion), S3/SQS/DynamoDB. No direct Zoom/Stripe.

### Database schemas

**No application PostgreSQL in this repo.**

#### DynamoDB — generation state
- Table env: `GENERATION_STATE_TABLE` / Terraform `report_generation_state`
- Keys: `campaign_id` (HASH) + `report_id` (RANGE); GSI `report_id-index`
- Lock rows: `report_id = LOCK#<templateType>`
- Statuses (Platform uppercase): `QUEUED`, `PULLING_DATA`, `GENERATING`, `RENDERING`, `UPLOADING`, `WAITING_FOR_TRANSCRIPT`, `COMPLETE`, `FAILED`
- Fields (conceptual): `template_type`, `sources[]`, window dates, `notify_emails`, `edit_instructions`, attempt/version counters, `s3_key_pdf`, notify stamps, errors

#### S3
Versioned `pdf` / `html` / `json` / model text under campaign/report prefixes; templates under `templates/{type}/{semver}/`.

Warehouse SQL remains on **Content Hub**.

### How it connects to other repos
| Peer | Role |
|------|------|
| platform-tool | Enqueue + list/download BFF + SES after ready |
| content-hub | Sole generate-time data (packet) |
| companion | LLM narrative via `/generate` |

### Config themes
`REPORTS_BUCKET`, `CONTENTHUB_BASE_URL` + M2M, `REPORT_REQUESTS_QUEUE_URL`, `GENERATION_STATE_TABLE`, `PLATFORM_BASE_URL`, `COMPANION_SERVICE_CONNECT_URL`, `COMPANION_INTERNAL_SECRET`, token/model knobs.

---

## 4. cht-companion

### What it does
Members-only **RAG chat API** and knowledge-base ingest for Community Health. FastAPI owns `POST /chat` (SSE Q&A) and plain `POST /generate` (used by reports). Chat UI + Nest BFF live in platform-tool. Separate KB Lambda (`cht-companion-kb`) chunks/embeds into pgvector.

### Stack
FastAPI, uvicorn, pydantic, psycopg3, boto3 (Bedrock), Redis (rate limit), pgvector. Infra: joins **existing** CHT ECS cluster + Service Connect; dedicated companion RDS; KB Lambda deploy lane.

### Architecture (high level)
```
React /app/chatbot → Nest BFF POST /api/chat (SSE)
  → Service Connect → cht-companion:8080/chat
       → pgvector retrieval + Bedrock chat
cht-reports → POST /generate (X-BFF-Auth) → Bedrock (no RAG)
EventBridge/SQS → KB Lambda → same companion DB
```

### External integrations
Amazon Bedrock (chat + Titan embeddings), YouTube captions (KB), Platform BFF (interactive chat), Reports (`/generate`), Secrets Manager for DB URL in Lambda.

### Database schemas (PostgreSQL + pgvector)

SQL migration `backend/db/migrations/001_kb_schema.sql` (extensions `pgcrypto`, `vector`).

| Table | Purpose |
|-------|---------|
| **sources** | Corpus unit (`source_id`) |
| **chunks** | Embeddings `vector(1024)`; HNSW cosine; FK → sources |
| **ingest_jobs** | Ingest audit |

**CHECK / literal enums:**  
`source_type`: `youtube_caption`, `catalog_clip`, `curated_doc`  
`status` (sources/chunks): `pending`, `approved`, `rejected`, `soft_deleted`  
`ingest_jobs.kind`: `initial`, `reindex`, `refresh`  
`ingest_jobs.status`: `queued`, `running`, `succeeded`, `failed`

**Member chat history** is stored in **platform** Prisma (`CompanionConversation` / `CompanionMessage`), not in the companion DB.

### How it connects to other repos
| Peer | Role |
|------|------|
| platform-tool | Sole chat BFF; Service Connect; shared secret and/or Cognito |
| reports | `/generate` with `COMPANION_INTERNAL_SECRET` |
| content-hub | Catalog clip IDs as KB source type |

### Config themes
`DATABASE_URL` / `DATABASE_SECRET_ARN`, `COMPANION_INTERNAL_SECRET`, Bedrock model IDs, rate limits, `CHT_ENVIRONMENT`.

---

## Supporting: cht-util-lambdas

### What it does
**Dev-only** weekday Eastern “lightswitch” Lambda to start/stop allowlisted ECS services and RDS instances (platform, companion, content hub, reports) for cost control, plus a stub cost reporter. Not a product API.

### Database
None (ops control plane).

### Touches (by name allowlist)
ECS: `cht-dev-backend`, `cht-dev-worker`, `cht-dev-companion`, `cht-reports-dev`, `contenthub-dev-*`  
RDS: `cht-dev-db`, `cht-dev-companion-db`, `contenthub-dev-db`

---

## Integration matrix (M2M / transport)

| From → To | Auth / transport | Destination |
|-----------|------------------|-------------|
| Platform → Hub catalog/admin | Cognito M2M `hub/*` | `…/api/public` or `/api/admin` |
| Hub → Platform export | Cognito M2M `platform/export.read` | Platform export API |
| Hub → Platform cache clear | Internal + `platform/cache.clear` | `POST …/internal/cache/…` |
| Platform → Companion chat | Service Connect + BFF / M2M | `http://cht-companion:8080/chat` |
| Reports → Hub packet | Cognito M2M `hub/reports.read` | `GET /api/campaigns/{id}/report-packet` |
| Reports → Companion | `X-BFF-Auth` = internal secret | `POST …/generate` |
| Reports → Platform ready | Cognito M2M `platform/reports.notify` | `POST …/internal/reports/{id}/ready` |
| Platform ↔ Reports DDB/SQS/S3 | IAM on reports Terraform | Shared account resources |

---

## Environments (typical)

| Env | Platform | Content Hub |
|-----|----------|-------------|
| Dev | `devapp.communityhealth.media` | `devhub.communityhealth.media` |
| Platform / UAT | `testapp.communityhealth.media` | (hub staging/prod naming per TF) |
| Production | `app.communityhealth.media` | `contenthub.communityhealth.media` |

On production app host, public marketing SPA routes are held (entry points: `/login`, `/join`); authenticated product lives under `/app` and `/admin`.

---

## Notes & caveats

1. Analysis preferred **`develop`** for all listed repos even when a local working tree was on a feature branch.
2. Schema detail for Platform is grounded in Prisma on `develop`; Hub schemas evolve via Alembic and may have additional revisions on feature branches.
3. `cht-companion-kb-bootstrap` may exist locally as a helper tree; it is not a primary runtime service repo.
4. Secrets are never listed here — only config *themes*.

---

*End of report.*
