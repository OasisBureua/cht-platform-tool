# CHT + MediaHub Go-Forward Options

**Prepared by:** Morgan A. Webster  
**Updated:** June 4, 2026 (aligned with engineering plans and leadership feedback)  
**Audience:** CHM leadership, CHT platform team, MediaHub engineering  
**Status:** **Option 3 selected**: decouple CHT now; reporting continuity first; MediaHub recovery second; full microservices migration third

---

## Executive Summary

CHT is a **production MVP** that needs enterprise hardening. MediaHub is still a **prototype** with structural issues that will likely take **6–8 months** to recover properly if pursued in full.

The team is **aligned on Option 3**: decouple CHT from MediaHub now, meet near-term reporting obligations through reliable APIs, vendor tools, and direct exports, and treat MediaHub as a **separate recovery/rebuild workstream**, not the roadmap controlling CHT progress or client reporting.

**Priority order:**

1. Decouple CHT now  
2. Meet near-term reporting obligations through reliable APIs, vendor tools, and direct exports  
3. Treat MediaHub as a separate recovery/rebuild workstream  
4. Only pursue full MediaHub microservices migration after we validate what is actually worth keeping  

The **Auth/Cognito plan is Phase 1** and moves forward **independently** of the larger MediaHub recovery effort. CHT owns identity through Cognito/MFA; end users no longer authenticate through MediaHub.

---

## Leadership Feedback (June 2026)

Thank you for putting these plans together. The work is strong and directionally aligned, especially around Cognito, GoTrue decommissioning, admin-only MediaHub access, and moving MediaHub toward a more stable architecture.

Both plans must fold clearly into this broader go-forward strategy:

- The **Auth/Cognito plan** is the immediate Phase 1 workstream, independent of MediaHub recovery.  
- The **MediaHub Microservices plan** is useful as a **longer-term recovery plan**, not the roadmap controlling CHT progress or reporting.  
- Before committing to rebuilding everything, complete a **keep/refactor/replace review** across reporting, chatbot, video organization, social analytics, clipping, HCP Intel, KOL pages, dashboards, and analytics.  

**MediaHub MVP** stays tightly scoped to what CHM actually needs for operational and contractual delivery:

- Video organization and search  
- Validated playlist structure  
- Downloadable reporting and accurate analytics  
- Client mapping (e.g. AstraZeneca vs other clients)  
- Admin and client views  
- Survey storage  
- Chatbot knowledge base updates  
- Exports and access control  

**Post-MVP:** HCP Intel and KOL pages. HCP Intel should be preserved and reviewed but must not block immediate reporting, CHT stabilization, or MVP delivery. KOL pages move to post-MVP unless needed for basic navigation.

---

## MediaHub MVP Scope

| In scope (MVP) | Post-MVP |
| -------------- | -------- |
| Video organization and search | HCP Intel (preserve and review; do not block MVP) |
| Validated playlist structure | KOL pages (unless needed for basic navigation) |
| Downloadable reporting | Full microservices rebuild before validation |
| Accurate analytics | |
| Client mapping (AstraZeneca vs all clients) | |
| Admin view and client view | |
| Post-event survey storage, insights, exports | |
| Chatbot knowledge base updates (new YouTube content) | |
| Access control (clients see own data; admins see all) | |

---

## Option 1: Decouple CHT Now, Fix MediaHub in Background, Reconnect Later

### What this means

CHT removes the highest-risk MediaHub dependencies now (authentication, conversation playlists, content/catalog workflows). MediaHub moves into a separate MVP recovery track. Once MediaHub meets defined MVP criteria, it reconnects to CHT as a controlled service layer.

### Timeline

| Period | Work |
| ------ | ---- |
| Month 1 | Finalize dependency map. Push HCP Intel and KOL pages to post-MVP. Confirm CHT decoupling scope. Define MediaHub MVP acceptance criteria. |
| Months 2–3 | Begin CHT decoupling: Cognito/MFA, playlist source of truth, content ownership, testing plan, reporting bridge planning. |
| Months 4–6 | MediaHub recovery: video backend, searchable content, playlist standards, downloadable reporting, survey storage, chatbot KB, client/admin views. |
| Months 7–8 | Formal QA and acceptance testing. Reconnect MediaHub only if it passes MVP criteria. |

### Pros and cons

**Pros:** Protects CHT while preserving MediaHub as a long-term product vision.  
**Cons:** Requires parallel workstreams and strict discipline. MediaHub cannot be treated as ready while still being recovered.

---

## Option 2: Stay Coupled and Fix MediaHub Before Market

### What this means

CHT remains tied to MediaHub while the team spends 6–8+ months fixing MediaHub before broader market or client readiness.

### Timeline

| Period | Work |
| ------ | ---- |
| Month 1 | Define joint MVP criteria. Map dependencies. Pause external readiness until both systems align. |
| Months 2–3 | Stabilize MediaHub infrastructure (RDS, S3, Redis, Secrets Manager, CI/CD, staging). |
| Months 3–4 | Fix analytics accuracy, tag pipeline, YouTube persistence, metric definitions. |
| Months 4–5 | Fix playlists, search, client/admin views, reporting structure. |
| Months 6–7 | Chatbot KB, exports, tenant isolation, access controls, compliance. |
| Month 8+ | Joint acceptance testing across CHT and MediaHub. |

### Pros and cons

**Pros:** Keeps the original connected ecosystem vision.  
**Cons:** **Highest risk.** Delays CHT enterprise progress and keeps the stronger platform dependent on the weaker one. Delays reporting and market readiness.

---

## Option 3: Decouple CHT, Use APIs/Vendor Tools for Reporting, Preserve Valuable Modules (SELECTED)

### What this means

CHT decouples from MediaHub now and uses reliable third-party APIs and vendor tools to meet immediate reporting obligations (e.g. Sprout or similar social listening/reporting tools, plus direct APIs where appropriate).

MediaHub no longer controls the immediate reporting timeline. The team preserves valuable modules, reviews what is worth keeping, and decides later whether MediaHub should be rebuilt, stabilized, or selectively reused.

### Timeline

| Period | Work |
| ------ | ---- |
| **First 2 weeks** | Decouple decision. Push HCP Intel and KOL pages to post-MVP. Finalize reporting requirements. Complete MediaHub dependency map. Evaluate vendor/API tools. |
| **Days 15–45** | Build minimum reporting bridge: vendor/API exports, YouTube data, attendance data, post-event survey data, reporting templates. |
| **Days 45–90** | Validate reporting outputs. Stabilize client/admin reporting views. Begin CHT decoupling. Remove highest-risk MediaHub dependencies (auth first). |
| **Months 4–6** | Keep/refactor/replace review across MediaHub modules. |
| **Months 6–8** | Recover or rebuild MediaHub only around validated MVP needs, if leadership continues MediaHub. |

### Workstream timing

| Workstream | Fastest reasonable | Stable |
| ---------- | ------------------ | ------ |
| Push HCP Intel + KOL pages to post-MVP | Immediate | Immediate |
| Dependency map | 3–5 business days | 1 week |
| Vendor/API evaluation | 1–2 weeks | 2–3 weeks |
| Reporting templates / SOP | 1–2 weeks | 2–3 weeks |
| Minimum reporting bridge | 2–4 weeks | 30–60 days |
| Stable reporting workflow | 30–60 days | 60–90 days |
| CHT decoupling and hardening | 60–90 days | 90–120 days |
| MediaHub MVP recovery (if continued) | 4–6 months (heavily scoped) | 6–8 months |
| MediaHub SOC 2 readiness | 6–12+ months | 12+ months |

### Pros and cons

**Pros:** Fastest path to meet reporting obligations, protect CHT, and reduce dependency risk. Usable reporting in **30–60 days**; stable operating model in **60–90 days**.  
**Cons:** Some custom MediaHub features delayed: appropriate because MediaHub is not currently MVP-ready.

---

## Option Comparison

| Option | Speed to business value | CHT progress | MediaHub progress | Reporting risk | Overall risk |
| ------ | ----------------------- | ------------ | ----------------- | -------------- | ------------ |
| **Option 1:** Decouple CHT, fix MediaHub in background | Medium | Continues | Separate 6–8 month recovery | Medium | Medium |
| **Option 2:** Stay coupled, fix MediaHub first | Slowest | Delayed | Central focus | High until fixed | **High** |
| **Option 3:** Decouple CHT, APIs/vendor tools | **Fastest** | **Fastest** | Selective recovery later | **Lowest near-term** | **Lowest near-term** |

---

## Recommended Path (Option 3)

| Phase | Timeline | Action |
| ----- | -------- | ------ |
| **Phase 1** | First 2 weeks | Decouple decision. Push HCP Intel/KOL to post-MVP. Finalize reporting requirements. Dependency map. Vendor/API evaluation. **Launch Cognito/Auth Phase 1 spec.** |
| **Phase 2** | Days 15–45 | Reporting bridge: PowerPoint reports, 3-page summaries, survey insights, attendance, video analytics, AstraZeneca views, downloads. |
| **Phase 3** | Days 45–90 | Validate reporting. Stabilize client/admin views. **Execute CHT Cognito migration.** Remove highest-risk MediaHub dependencies. |
| **Phase 4** | Months 4–6 | Keep/refactor/replace review. Preserve IP; do not let it block MVP. |
| **Phase 5** | Months 6–8 | Recover/rebuild MediaHub only around validated MVP needs, if leadership continues. |

---

## Final Position

The **6–8 month timeline applies only to MediaHub recovery**, not to CHT progress or reporting obligations.

The business should get useful value much faster:

| Outcome | Target |
| ------- | ------ |
| Reporting bridge | 30–60 days |
| Stable reporting operating model | 60–90 days |
| CHT decoupling and enterprise hardening (Cognito/MFA) | 60–90 days |
| MediaHub MVP recovery | 6–8 months |
| MediaHub SOC 2 readiness | 6–12+ months |

**In plain terms:** Decouple CHT now. Meet reporting through reliable APIs or vendor tools within 30–60 days. Push HCP Intel and KOL pages to post-MVP. Auth/Cognito is Phase 1. MediaHub recovery is second. Full microservices migration is third, only after keep/refactor/replace validation.

---

## Technical Development Plan: CHT Auth & Cognito Migration

**Workstream:** Phase 1: immediate; **independent** of MediaHub microservices recovery  
**Status:** Planned, not started  
**Immediate deliverable:** Cognito Migration & MediaHub Auth Decommission Specification

### Objective

CHT **owns the IdP** by migrating from MediaHub-hosted GoTrue/Supabase to **Amazon Cognito** (one user pool per environment, required TOTP MFA). **KOL, HCP, and industry users never authenticate through or access MediaHub.** MediaHub **decommissions GoTrue for all non-admin users** and stops receiving CHT auth user records. **API key integration is retained** for server-to-server catalog and HCP sync.

### Target identity model

| Actor | CHT app | Cognito (CHT-owned) | MediaHub UI | MediaHub API (key) |
| ----- | ------- | ------------------- | ----------- | ------------------ |
| HCP / KOL / Industry | Yes | Yes (via CHT only) | **No** | **No** |
| CHT admin | Yes | Yes | Yes (content ops) | Via CHT backend |
| CHT backend | N/A | Validates JWT | N/A | **Yes** (API key) |
| CHM MediaHub admin | N/A | Cognito `mediahub-admin` client | **Yes** | Admin API |

### Cognito configuration (recommended)

- **User pool:** `cht-platform-prod`: one pool per environment (platform, staging, dev)  
- **App client `cht-web`:** PKCE for CHT frontend (`testapp.communityhealth.media`)  
- **App client `mediahub-admin`:** MediaHub admin UI only; groups `mediahub-admins`, `mediahub-editors`  
- **Groups:** `cht-kol`, `cht-hcp`, `cht-pharma-client`: **never grant MediaHub access**  
- **MFA:** Required TOTP  
- **Sessions:** Retain CHT Postgres + httpOnly cookies  

### Current problem

Today CHT end users are **auth users on MediaHub**. The backend proxies signup/login/OAuth to GoTrue; `GOTRUE_JWT_SECRET` is shared; OAuth redirects hit `mediahub.communityhealth.media`. This must end.

### CHT codebase changes

| Component | Location | Action |
| --------- | -------- | ------ |
| GoTrue strategy | `backend/src/auth/gotrue.strategy.ts` | Replace with Cognito JWKS strategy |
| JWKS strategy | `backend/src/auth/jwt.strategy.ts` | Adapt for Cognito issuer/audience |
| Auth controller | `backend/src/auth/auth.controller.ts` | Rewire from GoTrue proxy to Cognito |
| OAuth URL builder | `frontend/src/lib/supabase-oauth.ts` | Remove: Cognito on CHT domain |
| Catalog / HCP sync | `mediahub.service.ts`, `mediahub-sync.service.ts` | **Keep**, API key only |
| Terraform secrets | `secrets-manager/` | Add Cognito; remove GoTrue post-cutover |

### Auth flows (target)

| Flow | Target |
| ---- | ------ |
| Email/password signup | CHT UI → backend → Cognito SignUp → CHT session |
| Email/password login | CHT UI → backend → Cognito InitiateAuth (+ MFA) → CHT session |
| Google OAuth | Cognito federated identity: CHT domain only |
| Password reset | Cognito ForgotPassword: CHT-branded emails |
| Admin login | Cognito + `@Roles(ADMIN)` in Postgres |
| Chatbot | Cognito access token via CHT backend |

### MediaHub coordination (auth cutover)

1. Decommission GoTrue for non-admin users: remove CHT learner/HCP/KOL accounts from shared auth  
2. Stop accepting CHT end-user OAuth redirect traffic  
3. Retain admin auth for MediaHub UI (Cognito `mediahub-admin` client)  
4. Confirm **API key remains valid** for CHT backend post-cutover  

### CHT implementation sequence

| Phase | Duration | Work |
| ----- | -------- | ---- |
| Planning | 1–2 weeks | Cognito + MediaHub decommission spec; user migration plan |
| Build | 3–5 weeks | Cognito Terraform; backend strategy; frontend auth swap |
| Staging | 1–2 weeks | Staging pool; MFA; OAuth; zero MediaHub auth URLs |
| Production cutover | 1 week | User migration; remove GoTrue secrets |
| Hardening | Ongoing | Auth tests in CI |

### CHT auth success criteria

- CHT owns IdP: Cognito + MFA in all environments  
- End users authenticate only through CHT: no MediaHub GoTrue or auth user records  
- MediaHub decommissions GoTrue for non-admins (confirmed by MediaHub team)  
- Only admins access MediaHub UI  
- API key integration retained for catalog/HCP sync  
- `GOTRUE_JWT_SECRET`, `SUPABASE_*` removed from CHT production  

---

## Technical Development Plan: MediaHub Microservices Migration

**Workstream:** Phase 4–5 recovery: **does not control CHT timeline or reporting**  
**Status:** Architecture plan complete; execution after keep/refactor/replace review  
**Source:** CHM MediaHub Microservices Migration Plan (June 2026)

### Objective

Migrate MediaHub from a monolithic FastAPI app on single EC2 to a decomposed, **admin-only** operations platform on AWS. CHT consumes data via **API key only** (`/api/public/*`). GoTrue is decommissioned for all non-admin access. Full microservices split proceeds only after leadership validates which modules are worth keeping.

### Current state (problem)

- Single FastAPI process on one EC2: scheduler, GPU render, LLM reports, API in one container  
- Shared GoTrue: end users (KOL, HCP, pharma) can obtain JWTs for MediaHub dashboards  
- PostgreSQL + Redis in Docker on same EC2; chatbot on bare metal  
- CHT users registered as MediaHub auth users via shared GoTrue  

### Target-state summary

- **CHT Platform** owns Cognito for all end-user identity  
- **MediaHub UI** is admin-only (CHM superadmin/admin/editor)  
- **CHT backend** consumes `/api/public/*` via `X-API-Key`: server-to-server, not user JWT  
- **GoTrue decommissioned** after admin accounts migrate to Cognito admin app client  
- **Monolith splits into:** core-api, worker, render-worker, report-worker, kb-worker, frontend, ECS Fargate  
- **Shared data layer:** RDS PostgreSQL, ElastiCache Redis, S3  

### Three access paths (target)

| Actor | Auth method | Access |
| ----- | ----------- | ------ |
| CHT end user (KOL/HCP/pharma) | Cognito JWT via CHT app | CHT Platform only: **NOT MediaHub UI** |
| CHM admin/operator | Cognito JWT via MediaHub admin client | MediaHub dashboard |
| CHT backend / integrations | `X-API-Key` (`PUBLIC_API_KEY`) | `/api/public/*` read APIs |
| ops-console | `X-API-Key` (`WEBHOOK_API_KEY`) | `/webhook/sync` write APIs |

### MediaHub auth middleware changes

- Replace GoTrue JWT verification with Cognito JWKS verification  
- `get_current_user`: require Cognito group `mediahub-admins` or `mediahub-editors`  
- Reject all Cognito tokens from `cht-web` app client at MediaHub middleware  
- Remove: public signup, self-registration, CHT register-profile for end users  
- Remove: GoTrue container from `docker-compose.prod.yml`  
- Keep: invitation flow for CHM staff only; `PUBLIC_API_KEY` and `WEBHOOK_API_KEY` in Secrets Manager  

### GoTrue decommission (MediaHub side)

| Step | Timeline | Actions |
| ---- | -------- | ------- |
| **A: Provision Cognito** | Weeks 1–2 | Create Cognito users for MediaHub admins/editors; dual-auth feature flag; admin login to Cognito Hosted UI |
| **B: Admin-only lockdown** | Weeks 2–3 | Remove viewer/pharma login paths; archive non-admin `public.users` rows; 403 for non-admin Cognito groups |
| **C: Decommission GoTrue** | Weeks 3–4 | Remove gotrue service, env vars, nginx `/auth/v1` proxy; remove GoTrueClient from auth_service.py |

### Service decomposition (when recovery approved)

| Service | Responsibility | Deploy |
| ------- | -------------- | ------ |
| mediahub-api | HTTP API, analytics, admin, public API, webhooks | ECS Fargate |
| mediahub-worker | Cron sync, metric snapshots, tag jobs | ECS Fargate |
| mediahub-render | FFmpeg GPU renders | EC2 g4dn / Batch |
| mediahub-reports | LLM report pipeline, PPTX | ECS Fargate |
| mediahub-kb | Transcript correction, KB indexing | ECS Fargate |
| mediahub-web | Next.js **admin** frontend | ECS Fargate / Amplify |
| chm-chatbot | RAG search (containerized) | ECS Fargate |

### Strangler fig extraction order

1. Extract mediahub-worker first: move scheduler out of API lifespan  
2. Introduce SQS for render and report jobs  
3. Extract mediahub-render to GPU host  
4. Extract mediahub-reports and mediahub-kb  
5. Split Docker images and ECS services  

### MediaHub phased roadmap

| Phase | Focus | Weeks | Notes |
| ----- | ----- | ----- | ----- |
| **0: Identity** | Cognito admin client; admin-only lockdown; GoTrue decommission; API keys in Secrets Manager | 1–4 | **Aligns with CHT Cognito Phase 1** |
| **1: Infra** | RDS Multi-AZ, Redis, S3, CI/CD, ECS Fargate staging | 3–8 | |
| **2: Workers** | Extract scheduler; SQS for render/report jobs | 6–10 | |
| **3: LLM isolation** | Reports + KB workers; containerize chatbot | 10–14 | |
| **4: Prod cutover** | Decommission EC2 Compose; monitoring; tenant isolation | 14–18 | |

**Estimated:** 4–5 months with 1–2 engineers. Phase 0 is prerequisite and runs in parallel with CHT Cognito cutover.

### CHT ↔ MediaHub integration contract

**CHT owns:** Cognito User Pool, CHT frontend, user profiles (NPI, user_type), all end-user UX, reporting bridge.

**MediaHub provides (API key only):**

- `GET /api/public/clips`: clip catalog  
- `GET /api/public/kols`: KOL network data  
- `GET /api/public/playlists`: playlist tags  
- `GET /api/public/status`: health monitoring  
- `POST /api/public/hcp/upsert`: HCP roster sync from CHT  

**MediaHub does NOT provide to CHT end users:** dashboard login, shared GoTrue JWT, register-profile for end users, invitation emails to external clients.

### Keep / refactor / replace review (Months 4–6)

Before full rebuild, review: reporting, chatbot, video organization, social analytics, clipping, HCP Intel, KOL pages, dashboards, analytics. **HCP Intel and KOL pages are post-MVP.**

### MediaHub recovery success criteria

- Zero GoTrue containers in production  
- Only Cognito admin-group users can access MediaHub UI  
- CHT consumes all public data via API key: verified by integration tests  
- API and worker run as separate ECS services  
- RDS automated backups with tested restore  

---

## CHT ↔ MediaHub Integration Summary

**CHT end user:** Opens `testapp.communityhealth.media` → Cognito (`cht-web`) → CHT session → CHT backend calls MediaHub with `X-API-Key` → data returned. **User never gets a MediaHub session.**

**CHM admin:** Opens `mediahub.communityhealth.media` → Cognito (`mediahub-admin`) → MediaHub dashboard. **End users never use this path.**

---

## Related Documents

- [CHT-Auth-Decoupling-Next-Steps-Report.md](./CHT-Auth-Decoupling-Next-Steps-Report.md): expanded CHT Cognito migration detail  
- [CHT-Platform-Assessment-Report.md](./CHT-Platform-Assessment-Report.md): CHT platform assessment  

**Prepared by:** Morgan A. Webster  
**Technical plans appended:** June 4, 2026
