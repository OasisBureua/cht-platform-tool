# CHT Platform

**Community Health Technologies — healthcare education and honorarium platform** connecting medical professionals with CME programs, live webinars, office hours, podcast content, and honorarium payments.

The platform is used by oncology KOLs, HCPs, and pharma partners. It delivers live CME sessions (via Zoom), post-event surveys, honorarium payouts (via Bill.com), a content catalog of clinical conversations (via MediaHub), and a podcast library — all in one place.

---

## What It Does

| Area | Description |
|---|---|
| **Live sessions** | Zoom-powered webinars and CHM Office Hours with registration, approval workflows, and post-event flows |
| **Surveys** | JotForm-integrated post-session surveys that gate honorarium eligibility |
| **Payments** | Automated honorarium payouts via Bill.com ACH/check, triggered on survey + attendance completion |
| **Content library** | MediaHub-integrated video catalog with disease-area playlists, KOL clips, and biomarker rows |
| **Podcasts** | In-app podcast catalog (Breast Friends, CHM audio) with show pages and episode listings |
| **KOL Network** | DOL / digital opinion leader directory with region filtering, profile pages, and catalog content links |
| **Admin portal** | Program scheduling, webinar approvals, HCP explorer, payment queue, analytics |

---

## Project Structure

```
cht-platform/
├── backend/          # NestJS API server (TypeScript)
├── worker/           # Python background workers (SQS consumers)
├── frontend/         # React 18 web application
├── infrastructure/   # Terraform IaC (AWS)
├── docs/             # Extended documentation
└── scripts/          # Deployment & utility scripts
```

---

## Tech Stack

### Frontend
- **React 18** + TypeScript, Vite, Tailwind CSS
- **React Router v6** (lazy-loaded routes)
- **React Query** (server state, caching)
- **Lucide React** (icons)
- Auth: Supabase/GoTrue (production) or dev-bypass header

### Backend (NestJS)
- **PostgreSQL** + Prisma ORM
- **Supabase / GoTrue** — authentication (hosted by MediaHub)
- **AWS SQS** — job queuing (email, payments, CME certificates)
- **Zoom** — webinar and meeting creation + webhook handling
- **JotForm** — survey intake and webhook processing
- **Bill.com** — honorarium payouts (ACH / check)
- **Amazon SES** — transactional email (reminders, access links, missed-session notifications)

### Worker (Python 3.11)
- **Boto3** / AWS SDK — SQS consumer base
- **Amazon SES** — email delivery
- **ReportLab** — CME certificate PDF generation
- SQS consumers: `email_consumer`, `payment_consumer`, `cme_consumer`

### Infrastructure (AWS)
- **ECS Fargate** — backend + worker containers
- **RDS (PostgreSQL)** — primary database
- **ElastiCache (Redis)** — caching / queue metadata
- **SQS + DLQ** — async job processing with retry / dead-letter
- **S3 + CloudFront** — frontend static hosting + CDN
- **ALB** — backend load balancer
- **Terraform** — all infrastructure as code

---

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop
- AWS CLI (for deployment only)
- Terraform (for infrastructure only)

### 1. Start database and Redis

```bash
docker-compose up -d
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in the required values (DATABASE_URL, SUPABASE_*, ZOOM_*, JOTFORM_*, etc.)
npx prisma migrate dev
npm run start:dev
```

### 3. Worker

```bash
cd worker
pip install -r requirements.txt
# Set DATABASE_URL, SQS_*_QUEUE_URL, BILL_* in environment or .env
python start_workers.py
```

### 4. Frontend

```bash
cd frontend
npm install
# Create frontend/.env:
# VITE_API_URL=http://localhost:3000/api
# VITE_USE_DEV_AUTH=true          (skip Supabase locally)
# VITE_DEV_USER_ID=<seed-user-id> (see below)
npm run dev
```

### 5. Seed a dev user (first time only)

```bash
cd backend && npx prisma db seed
# Prints a user ID — paste into VITE_DEV_USER_ID
```

Access points once running:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api
- API Docs (Swagger): http://localhost:3000/api

---

## Key Flows

### Completion → Payment

1. HCP attends live session (Zoom webhook confirms attendance).
2. JotForm post-event survey submitted → backend marks enrollment eligible.
3. SQS: payment job queued → Python worker calls Bill.com → honorarium paid.
4. CME certificate generated (PDF) and emailed via SES.

### Webinar / Office Hours scheduling

Admin uses `/admin/webinar-scheduler` or `/admin/office-hours-scheduler` to create a Zoom session. The backend creates the meeting/webinar via the Zoom API, stores it in Postgres, and sends calendar invites.

### Survey intake

JotForm webhooks hit `/api/jotform/webhook`. The service maps the submission to the correct enrollment, advances the post-event flow, and queues payment if all eligibility criteria pass.

---

## Frontend Routes

| Path | Description |
|---|---|
| `/home` | Public marketing home |
| `/catalog` | Public video library (MediaHub clips + playlists) |
| `/kol-network` | DOL / KOL directory |
| `/kol-network/profile/:id` | KOL profile page |
| `/live`, `/chm-office-hours` | Public upcoming sessions |
| `/app/home` | Authenticated HCP dashboard |
| `/app/live`, `/app/chm-office-hours` | Live sessions and office hours |
| `/app/podcasts` | Podcast catalog |
| `/app/surveys` | Survey queue |
| `/app/earnings`, `/app/payments` | Earnings and payout history |
| `/admin` | Admin dashboard (admin role required) |
| `/admin/programs`, `/admin/office-hours` | Session management |
| `/admin/webinar-approvals` | Approval queue |
| `/admin/payments` | Payment queue |
| `/admin/users`, `/admin/hcp-explorer` | User management |

---

## Architecture

See [docs/architecture.md](docs/architecture.md) for the full diagram and service interaction details.

---

## Deployment

See [docs/deployment.md](docs/deployment.md) for step-by-step deployment instructions.

The short version:

```bash
# Deploy to staging
./scripts/deploy-primary.sh staging

# Deploy to prod
./scripts/deploy-primary.sh prod
```

GitHub Actions handle CI on every PR (`pr-validation.yml`) and CD on merge to `main`/`staging`.

---

## Local Development Helpers

Two optional scripts catch issues before CI:

```bash
./verify.sh           # typecheck + lint + tests for frontend + backend
./verify.sh frontend  # frontend only
./verify.sh backend   # backend only

./smoke.sh                                        # hits testapp health endpoints
./smoke.sh https://testapp.communityhealth.media  # explicit target
```

`verify.sh` mirrors the checks in `.github/workflows/pr-validation.yml` — find failures locally in ~60 seconds instead of waiting for CI.

`smoke.sh` hits health endpoints and critical public pages post-deploy to confirm nothing obvious is broken.

Both scripts are optional — GitHub Actions remain the source of truth.

---

## Docs

| File | Description |
|---|---|
| [docs/getting-started.md](docs/getting-started.md) | Detailed local dev setup + env variables |
| [docs/architecture.md](docs/architecture.md) | System architecture |
| [docs/deployment.md](docs/deployment.md) | Deployment guide |
| [docs/ZOOM-WEBINAR-PARTICIPANT-TRACKING.md](docs/ZOOM-WEBINAR-PARTICIPANT-TRACKING.md) | Zoom webhook + attendance tracking |
| [docs/JOTFORM-SETUP.md](docs/JOTFORM-SETUP.md) | JotForm webhook configuration |
| [docs/payment-apis.md](docs/payment-apis.md) | Bill.com payment API reference |
| [docs/POST-MVP-ROADMAP.md](docs/POST-MVP-ROADMAP.md) | Planned features and roadmap |
