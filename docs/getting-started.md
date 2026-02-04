# Getting Started

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop
- AWS CLI (for deployment)
- Terraform (for infrastructure)

## Local Development Setup

### 1. Start Database & Redis
```bash
docker-compose up -d
```

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
npx prisma migrate dev
npm run start:dev
```

### 3. Setup Worker
```bash
cd worker
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your values
python start_workers.py
```

### 4. Setup Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend API base URL. Local: `http://localhost:3000/api`. Production: `https://api.yourdomain.com/api` |
| `VITE_AUTH0_DOMAIN` | No* | Auth0 tenant domain (e.g. `your-tenant.auth0.com`) |
| `VITE_AUTH0_CLIENT_ID` | No* | Auth0 application client ID |
| `VITE_AUTH0_AUDIENCE` | No* | Auth0 API identifier |
| `VITE_DEV_USER_ID` | No** | Dev bypass: user ID from `npx prisma db seed` when Auth0 not configured |

\* Required for production OAuth; omit for local dev with `X-Dev-User-Id` bypass.  
\** Required for dev mode when Auth0 is not configured.

### Backend (`backend/.env`)

See `backend/.env.example`. Key: `DATABASE_URL` (required), `REDIS_HOST`, `AUTH0_*`, `SQS_*`, etc.

### Worker (`worker/.env`)

See `worker/.env.example`. Key: `DATABASE_URL` (required), `SQS_*_QUEUE_URL`, `STRIPE_SECRET_KEY`, etc.

## Access Points

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Docs: http://localhost:3000/api
- Database: localhost:5432
- Redis: localhost:6379

## Completion → Payment Flow

**Program completion (all videos watched):**
1. Frontend calls `POST /api/programs/video-progress` with progress.
2. Backend marks enrollment `completed`, sends to SQS: Email, CME certificate, Payment (honorarium).
3. Worker processes payment queue (Stripe transfer, Payment record).

**Survey completion:**
1. Frontend calls `POST /api/surveys/:id/responses` with answers.
2. Backend creates SurveyResponse, sends SURVEY_BONUS to payment queue (if `SURVEY_BONUS_AMOUNT_CENTS` > 0).
3. Worker processes payment.

Set `SURVEY_BONUS_AMOUNT_CENTS` (e.g. 500 = $5) to enable survey bonuses.

## Worker: Retries, DLQ & Logging

Workers use a shared `SQSBaseConsumer` with:

- **Retry on failure**: When processing fails, the message is not deleted; it becomes visible again after `VisibilityTimeout` and is retried.
- **DLQ (Dead Letter Queue)**: SQS redrive policy (maxReceiveCount=3) sends messages to DLQ after 3 failed receives. Terraform configures DLQs for email, payment, and CME queues.
- **Malformed messages**: Invalid JSON is logged and deleted to avoid infinite retries.
- **Structured logging**: JSON logs include `message_id`, `receive_count`, and full tracebacks on errors (`exc_info=True`).
- **Poll resilience**: Consecutive poll errors trigger exponential backoff (5s → 60s after 10 failures).

CloudWatch alarms fire when messages appear in any DLQ; investigate those messages in the AWS console.

## Auth & Local Development

- **Auth0 configured** (`AUTH0_DOMAIN`, `VITE_AUTH0_*`): Full OAuth login.
- **Auth0 not configured**: Dev bypass using `X-Dev-User-Id` header.

For local dev without Auth0:

```bash
cd backend
npx prisma db seed   # Creates dev user, prints X-Dev-User-Id
```

Add to `frontend/.env`:
```
VITE_DEV_USER_ID=<user-id-from-seed>
```

Or at runtime: on Login page, click Login → enter the user ID from seed.

## Testing the Backend

After starting Docker and the backend:

```bash
# 1. Seed dev user (first time)
cd backend && npx prisma db seed

# 2. Health checks
./scripts/test-health.sh

# 3. API endpoints (programs, dashboard, etc.)
./scripts/test-backend-api.sh
```

Or test manually:
- `curl http://localhost:3000/` - App info
- `curl http://localhost:3000/health` - Health
- `curl http://localhost:3000/health/ready` - Readiness (DB + Redis)
- `curl http://localhost:3000/api/programs` - List programs (public)
