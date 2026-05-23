# Getting Started

Local setup for backend, worker, and frontend.

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop
- AWS credentials (only if running workers against real SQS queues)

## 1. Database

```bash
docker-compose up -d
```

This starts PostgreSQL on `localhost:5432` (`cht_platform` / `postgres` / `postgres`).

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run start:dev
```

Fill in `.env` for any integrations you need locally (Zoom, JotForm, Bill.com, MediaHub). Auth and database are enough for most UI work.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string |
| `FRONTEND_URL` | CORS / redirect base (`http://localhost:5173`) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOTRUE_JWT_SECRET` | Production auth (optional locally) |
| `SESSION_TTL_SECONDS` | Session lifetime (default 1800) |
| `ZOOM_*` | Webinar creation and webhooks |
| `JOTFORM_API_KEY` | Survey clone / webhook verification |
| `BILL_*` | Honorarium payouts (worker) |
| `MEDIAHUB_API_KEY` | Content catalog |
| `SQS_*_QUEUE_URL` | Async jobs (worker) |
| `AWS_*`, `EMAIL_FROM` | SES email (worker) |

API: http://localhost:3000/api  
Swagger: http://localhost:3000/api

## 3. Worker (optional)

Only needed for email, payment, or CME certificate jobs.

```bash
cd worker
pip install -r requirements.txt
python start_workers.py
```

Set `DATABASE_URL` and the relevant `SQS_*_QUEUE_URL` values. Without SQS, the API still runs; async jobs simply won't process.

## 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_USE_DEV_AUTH=true
VITE_DEV_USER_ID=<uuid-from-seed>
```

Seed a dev user:

```bash
cd backend && npx prisma db seed
```

Copy the printed user ID into `VITE_DEV_USER_ID`. With dev auth enabled, the frontend sends `X-Dev-User-Id` instead of using Supabase login.

Frontend: http://localhost:5173

## Pre-commit checks

```bash
./verify.sh           # frontend + backend typecheck, lint, tests
./verify.sh frontend  # frontend only
./verify.sh backend   # backend only
```

## Production auth locally

To test real Supabase/GoTrue login instead of dev bypass:

1. Set `VITE_USE_DEV_AUTH=false` in `frontend/.env`
2. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
3. Add `http://localhost:5173` to GoTrue redirect allowlist (MediaHub)
