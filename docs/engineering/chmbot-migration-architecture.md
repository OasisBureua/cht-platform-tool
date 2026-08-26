# CHT Chat Migration: EC2 chmbot → cht-chat on ECS

**Status:** Architecture proposal — **recommendations locked for planning** (§16)  
**Owner:** Platform  
**Related:** [CHT-MediaHub-Go-Forward-Options.md](../reports/CHT-MediaHub-Go-Forward-Options.md), [mediahub-platform-cutover.md](../runbooks/mediahub-platform-cutover.md), [cognito-migration-spec.md](../runbooks/cognito-migration-spec.md)

Migrate the MediaHub-hosted **chmbot** off shared EC2 into a CHT-owned **`cht-chat`** service on **ECS Fargate**, with **Service Connect only** (CHT backend is the sole caller), **`cht-chat-db` + pgvector**, and a path to **fully decommission MediaHub** for chat cost savings.

### Executive recommendations (TL;DR)

| Topic | Recommendation |
| ----- | -------------- |
| Compute | **Hybrid:** Fargate `cht-chat` on **existing** CHT ECS cluster; **Lambda + EventBridge/SQS** for KB (not a new cluster; not Lambda-only Q&A) |
| Networking | Service Connect only + NestJS BFF |
| DB / vectors | New **`cht-chat-db`** + **pgvector** |
| LLM | **Amazon Bedrock** (Claude) for v1 |
| Corpus | **CHT catalog clip metadata + YouTube captions** as primary; curated docs later |
| S3 | **Skip at launch**; add raw-archive bucket only if reprocess/audit needs it |
| UI | **First-party React chat** on `/app/chatbot` (no iframe) |
| Bubble | **Members-only** (same authenticated API); drop anonymous public chat |
| Code home | **Separate repo** (`cht-chat`) — not `cht-platform-tool` or Content Hub; CHT keeps BFF + UI |
| API shape | **SSE streaming** via NestJS proxy |
| RDS size (start) | **`db.t4g.small`**, single-AZ staging / Multi-AZ prod when traffic justifies |

---

## 1. Why migrate

Today the chatbot runs on the same MediaHub EC2 as the monolith. That creates:

| Risk | Impact |
| ---- | ------ |
| Single host SPOF | Chatbot outage if EC2 / Compose fails |
| Cost & coupling | Paying for MediaHub host capacity for a CHT-only UX |
| Auth coupling | GoTrue JWT via iframe; Cognito cutover breaks authenticated chat |
| No independent scale | RAG competes with Hub workloads on one box |

**Goal:** First-party CHT chat (`cht-chat`), private to the platform VPC, independent DB and deploys, no MediaHub runtime dependency.

---

## 2. Current architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│ CHT Platform (cht-platform-tool)                                 │
│  Browser → CloudFront → S3 (React)                               │
│    /app/chatbot  → ChatBot.tsx iframe                            │
│    ChatBubble    → floating iframe (anonymous only today)        │
│  NestJS GET /api/auth/chatbot-token → session accessToken        │
└────────────────────────────┬────────────────────────────────────┘
                             │ iframe + ?token=<JWT>
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│ MediaHub EC2                                                     │
│  https://chmbot.communityhealth.media/widget                     │
│  chmbot process + Hub monolith + Docker Postgres/Redis + KB      │
└─────────────────────────────────────────────────────────────────┘
```

| Surface | Detail |
| ------- | ------ |
| Full page | `frontend/src/pages/ChatBot.tsx` → hardcoded widget URL |
| Bubble | `frontend/src/components/ChatBubble.tsx` → same URL, no token |
| Token | `GET /api/auth/chatbot-token` |

There is **no** chatbot Terraform/ECR in this repo today. Target: own it under CHT (`cht-chat` + `cht-chat-db`).

---

## 3. Compute: Lambda + EventBridge vs ECS (recommendation)

**Do not stand up a new ECS cluster just for chat.** Reuse the existing CHT cluster. Split **request path** vs **ingest path**:

| Workload | Recommended | Why |
| -------- | ----------- | --- |
| **Interactive RAG / chat API** (`cht-chat`) | **ECS Fargate service** on the **existing** CHT cluster + Service Connect | Streaming/SSE, multi-second Bedrock calls, stable warm process, easy NestJS proxy, no Lambda timeout/payload pain |
| **KB ingest / re-embed** (`cht-chat-kb`) | **Lambda + EventBridge (and/or SQS)** | Bursty, schedulable, scale-to-zero; cheapest for caption fetch + embed jobs |
| **Whole chat on Lambda only** | **Not recommended for v1** | Awkward streaming via BFF, cold starts, 15‑min cap, VPC+RDS cold path, weaker Service Connect fit |
| **New ECS cluster for chat** | **No** | Extra ALB/cluster overhead; share `cht-platform-cluster` (or env equivalent) |

```text
Recommended hybrid:

  NestJS (existing ECS)  --Service Connect-->  cht-chat (Fargate, same cluster)
                                                      |
                                                      v
                                                 cht-chat-db (pgvector)

  EventBridge schedule / SQS  -->  cht-chat-kb (Lambda)  -->  cht-chat-db
```

### Why not Lambda-only for chat answers?

- Member chat wants **streaming** and often **>30s** retrieval+generation; Lambda can do this (Function URLs / response streaming) but NestJS→Lambda→Bedrock is more glue and harder to operate than NestJS→Fargate Service Connect.
- pgvector in **VPC RDS** + Lambda means ENI/cold-start tax on every question unless you over-provision concurrency.
- You already run NestJS on Fargate; one more small service is incremental, not a new platform.

### When Lambda-first would be OK

If v1 is **non-streaming**, low QPS, and you accept folding RAG into NestJS (retrieve in-process or sync Lambda invoke), you could skip `cht-chat` Fargate entirely and only use **Lambda for KB jobs**. That is the cheapest compute envelope—but couples RAG deeper into the platform API. Prefer the **hybrid** above for a clean separate `cht-chat` repo with a clear HTTP contract.

### Cost note

| Pattern | Idle cost | Fit |
| ------- | --------- | --- |
| Fargate `cht-chat` desired 1–2 | Small always-on | Answers |
| Lambda KB | ~$0 idle | Ingest |
| Always-on ECS “kb worker” | Wastes money | Avoid |
| Separate ECS cluster | Extra fixed cost | Avoid |

**Chosen:** hybrid — **Fargate `cht-chat` on existing cluster** + **Lambda/EventBridge(+SQS) for KB**. Not Lambda-only for Q&A; not a dedicated chat cluster.

---

## 4. Target architecture (decided direction)

| Decision | Choice |
| -------- | ------ |
| Service | **`cht-chat`** (replaces chmbot) |
| Database | **`cht-chat-db`** — dedicated Postgres + **pgvector** |
| Exposure | **ECS Service Connect only** — only CHT NestJS calls it |
| MediaHub | **Decommission for chat** — no Hub EC2/RDS dependency for RAG |
| UI | **React** `/app/chatbot` → `/api/chat/*` (no iframe) |
| Access | **Members-only** (no anonymous LLM) |
| LLM | **Bedrock** |
| Corpus | CHT catalog IDs + YouTube captions |
| S3 | Skip at launch |

```text
 Browser (CHT React)
        │  same-origin /api/chat/*  (session / Cognito)
        ▼
 ┌──────────────────────┐
 │ CHT NestJS (ECS)     │  BFF: auth, rate limits, SSE/proxy
 │ cht-platform-backend │
 └──────────┬───────────┘
            │  Service Connect → http://cht-chat:8080
            ▼
 ┌──────────────────────┐         ┌─────────────────────┐
 │ cht-chat (Fargate)   │────────▶│ cht-chat-db (RDS)   │
 │ same CHT ECS cluster │         │ Postgres + pgvector │
 └──────────────────────┘         └──────────▲──────────┘
                                             │
 ┌──────────────────────┐                    │
 │ cht-chat-kb (Lambda) │────────────────────┘
 │ EventBridge / SQS    │
 └──────────────────────┘
            │
            ▼
      Bedrock / LLM APIs (NAT egress)
```

### Service decomposition

| Service | Role | Notes |
| ------- | ---- | ----- |
| **cht-chat** | RAG API | Fargate on **existing** CHT cluster + Service Connect; **no public ALB**; **no new cluster** |
| **cht-chat-kb** | Chunk + embed jobs | **Lambda** + EventBridge/SQS → `cht-chat-db` (scale to zero) |
| **cht-chat-db** | Vector + chunk SoR | Small RDS; not CHT Aurora |
| **CHT BFF** | `/api/chat/*` | Existing NestJS; sole ingress |
| **S3** | Skip v1 | Add later only for raw archives |
| **Secrets / CW** | Keys, logs, alarms | Same platform patterns |

---

## 5. Auth model

### Today

Iframe + GoTrue/Cognito token query param; anonymous bubble rate-limited on chmbot.

### Target (BFF + Service Connect)

| Mode | Auth | Enforced at |
| ---- | ---- | ----------- |
| Logged-in member | CHT session / Cognito | NestJS `/api/chat/*` |
| Anonymous (if kept) | IP / session rate limit | NestJS |
| `cht-chat` | Private VPC + SG + Service Connect (± internal secret) | No public JWT on chat service required |

Retire `/api/auth/chatbot-token` and `chmbot.*` after cutover.

---

## 6. Knowledge base & do you still need S3?

```text
Sources (YouTube / CHT catalog / curated docs — not MediaHub long-term)
        │
        ▼
 cht-chat-kb → chunk + embed
        │
        ▼
 cht-chat-db (pgvector)  ← system of record for retrieval
        │
        ▼
 cht-chat → retrieve → LLM → answer + citations
```

### S3 answer

**No — S3 is not required as the KB** when using pgvector.

| | Role |
| - | ---- |
| **`cht-chat-db`** | Chunk text + embeddings + citation metadata (**RAG index**) |
| **S3** | **Optional** cheap archive of raw VTT/JSON/PDFs for reprocess/audit |

| Approach | When |
| -------- | ---- |
| **Skip S3 (fine to start)** | Corpus fits in RDS; re-fetch from YouTube/API on full rebuild |
| **Add small S3 later** | Large raw files, drop-zone ingest, cheaper cold storage than Postgres |
| **Avoid** | Using S3 itself as the similarity-search store |

---

## 7. Networking & security

| Control | Target |
| ------- | ------ |
| Ingress to `cht-chat` | Service Connect from NestJS only |
| Public chat ALB / `chmbot.*` | None after cutover |
| DB | Private; SG from `cht-chat` + `cht-chat-kb` only |
| LLM egress | NAT |
| Secrets | Secrets Manager; no keys on EC2 |

---

## 8. Repo & CI/CD

| Item | Proposal |
| ---- | -------- |
| Code | **Separate `cht-chat` repo** (RAG + KB worker + chat Terraform); CHT platform keeps BFF `/api/chat/*` + React UI |
| Images | ECR `cht-chat`, `cht-chat-kb` |
| Deploy | GitHub Actions → ECS (mirror backend) |
| Infra | Terraform: ECS services, Service Connect, `cht-chat-db`, SG, secrets |
| Frontend | Replace iframe with CHT chat UI calling `/api/chat/*` |

---

## 9. Migration phases

### Phase 0 — Design & containerize

- [ ] Inventory current chmbot deps, prompts, corpus sources  
- [ ] Dockerfile for `cht-chat`; decide BFF API shape (sync vs SSE)  
- [ ] Confirm content sources after MediaHub decommission (YouTube / CHT catalog)

### Phase 1 — Staging

- [ ] Provision **`cht-chat-db`** (Postgres + `vector`)  
- [ ] ECS `cht-chat` + Service Connect; NestJS proxy in staging  
- [ ] Seed KB via `cht-chat-kb` (optional S3 skip)  
- [ ] Frontend staging: no iframe  

### Phase 2 — Prod cutover

- [ ] Deploy prod `cht-chat` / `cht-chat-db` / BFF routes  
- [ ] Switch `/app/chatbot` + bubble to CHT APIs  
- [ ] Stop EC2 chmbot; leave DNS only if temporary redirect  
- [ ] 48h soak  

### Phase 3 — Decommission

- [ ] Remove `chmbot.*` / MediaHub chat dependency  
- [ ] Delete chatbot-token path if unused  
- [ ] Update architecture diagrams and IR docs  

---

## 10. Cutover checklist

**Pre:** staging BFF→Service Connect works; RAG spot-checks; rollback plan (feature flag to old iframe only if EC2 still up).  

**Go:** enable `/api/chat/*` in prod; disable iframe.  

**Post:** EC2 chatbot stopped; no MediaHub calls on chat path; alarms green 48h.

---

## 11. Rollback

1. Feature-flag frontend back to iframe **only while EC2 chmbot still runs**.  
2. Or serve static “chat unavailable” if Hub already gone.  
3. Keep `cht-chat` tasks up for fast re-enable.

---

## 12. Success criteria

- [ ] Production chat via **`cht-chat`** on Fargate + Service Connect  
- [ ] **`cht-chat-db` + pgvector** is the RAG store  
- [ ] No public chatbot URL required for CHT members  
- [ ] No MediaHub EC2 dependency for chat  
- [ ] CHT session/Cognito enforced at NestJS BFF  

---

## 13. Cost sketch

| Component | Notes |
| --------- | ----- |
| Fargate `cht-chat` (± kb worker) | Modest always-on |
| **`cht-chat-db` small RDS** | Primary new fixed cost (still ≪ OpenSearch Serverless) |
| No chat ALB | Saves vs public widget ALB |
| S3 | $0 if skipped; pennies–low if raw archive only |
| LLM tokens | Usage-driven; set budgets |

Decommissioning MediaHub EC2 (for chat and eventually Hub) is the large savings lever.

---

## 14. Service Connect (confirmed)

Because **only CHT** will call chat:

1. No public ALB for `cht-chat`.  
2. Service Connect name e.g. `cht-chat:8080`.  
3. NestJS BFF proxies `/api/chat/*`.  
4. React talks to CHT only (same origin).

Browsers never resolve Service Connect names — the BFF is mandatory for this model.

---

## 15. Vector store & database (confirmed)

| Topic | Decision |
| ----- | -------- |
| Engine | **pgvector** (not OpenSearch for v1) |
| Database | **New `cht-chat-db`** |
| Not on | CHT Aurora, Content Hub DB, MediaHub RDS |

OpenSearch only if hybrid search/scale later demands it.

---

## 16. Recommendations (locked for planning)

These close the former open decisions. Treat as the default build plan unless product explicitly overrides.

### 16.1 LLM → **Amazon Bedrock (Claude)**

| Option | Verdict |
| ------ | ------- |
| **Bedrock (recommended)** | IAM auth via task role (no long-lived API keys in Secrets for the model), AWS BAA path, CloudWatch-friendly, fits private VPC egress story |
| Direct OpenAI/Anthropic API | Fine as fallback; more key rotation / vendor surface |

**v1:** one chat model (e.g. Claude Sonnet-class) + one embedding model on Bedrock (or Titan embeddings). Abstract behind an interface so the provider can change later. Set **monthly budget alarms** on Bedrock spend day one.

### 16.2 Corpus after MediaHub → **CHT catalog + YouTube captions**

Do **not** keep a long-term MediaHub dependency for KB ingest.

| Source | Role |
| ------ | ---- |
| **Primary** | Clip/show IDs and titles already known to CHT (catalog / podcasts) → fetch **YouTube captions/transcripts** in `cht-chat-kb` |
| **Secondary (phase 2)** | Curated admin uploads (FAQ, program disclaimers, policy snippets) into `cht-chat-db` |
| **Avoid as SoR** | Scraping MediaHub admin DB or relying on Hub EC2 for transcripts |

Export a one-time snapshot from current chmbot/Hub KB only as a **bootstrap** seed, then own refresh in CHT.

### 16.3 S3 → **skip at launch**

pgvector in `cht-chat-db` is enough for RAG. Re-fetch captions from YouTube on full rebuild. **Add** `cht-chat-raw` S3 later only if you need durable raw VTT/PDF archives or an admin drop-zone.

### 16.4 Chat UI → **first-party React**

Rebuild `/app/chatbot` (and bubble) as CHT React calling **`/api/chat/*`**. Do not keep an iframe widget—even behind a BFF—unless timeline forces a temporary shim.

**BFF API:** prefer **SSE** (or chunked streaming) so answers feel live; NestJS proxies streams to `cht-chat` over Service Connect.

### 16.5 Anonymous bubble → **members-only**

Require login for chat (full page + bubble). Anonymous public LLM access adds abuse/cost risk with little product value once chat is CHT-owned. Guests see a sign-in CTA.

### 16.6 Code & sizing defaults

| Item | Recommendation |
| ---- | -------------- |
| Repo | **`cht-chat` separate repository**; platform deploys via Service Connect contract |
| `cht-chat` tasks | Start **desired 1** staging / **2** prod; 0.5–1 vCPU |
| `cht-chat-kb` | **Lambda** (+ EventBridge/SQS); never always-on Fargate |
| `cht-chat-db` | Start **`db.t4g.small`**, gp3; enable `vector`; Multi-AZ when chat is prod-critical |
| Feature flag | `CHAT_PROVIDER=legacy_iframe \| cht_chat` during cutover |

### 16.7 Build sequence (recommended)

1. Terraform: `cht-chat-db` + ECS `cht-chat` + Service Connect + SG  
2. NestJS `/api/chat/*` BFF (auth + SSE proxy) + React chat UI behind flag  
3. `cht-chat-kb`: YouTube caption ingest → embeddings → pgvector  
4. Staging quality gate (fixed prompt set vs old chmbot)  
5. Prod flag flip → stop EC2 chmbot → retire token/iframe code  

---

## 17. Related documents

| Doc | Relevance |
| --- | --------- |
| [platform-cost-reduction.md](./platform-cost-reduction.md) | EC2 off, dev lightswitch, right-sizing |
| [CHT-MediaHub-Go-Forward-Options.md](../reports/CHT-MediaHub-Go-Forward-Options.md) | Broader Hub recovery / decommission context |
| [mediahub-platform-cutover.md](../runbooks/mediahub-platform-cutover.md) | Hub ECS cutover (chat can precede full Hub retirement) |
| [cognito-migration-spec.md](../runbooks/cognito-migration-spec.md) | Legacy chatbot JWT gap — moot once BFF owns auth |
| [architecture.md](./architecture.md) | CHT platform overview |
| [FRS-APP-013](../FRS-functional-requirements-specification.md) | Chatbot functional requirement |
