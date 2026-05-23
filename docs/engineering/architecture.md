# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│              CloudFront + S3 (React frontend)                 │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Load Balancer                 │
└────────────────────────────┬────────────────────────────────┘
                             │
         ┌───────────────────┴───────────────────┐
         ▼                                       ▼
┌─────────────────┐                   ┌─────────────────┐
│  ECS: Backend   │                   │  ECS: Worker    │
│  NestJS API     │                   │  Python SQS     │
└────────┬────────┘                   └────────┬────────┘
         │                                     │
         └──────────────┬──────────────────────┘
                        ▼
              ┌─────────────────┐
              │  RDS PostgreSQL │
              └─────────────────┘

External: Supabase/GoTrue (auth), Zoom, JotForm, Bill.com, MediaHub, SES
Async: SQS queues (email, payment, CME) with DLQs
```

## Components

| Layer | Technology | Role |
|-------|------------|------|
| Frontend | React 18, Vite, Tailwind | HCP app, admin portal, public catalog |
| Backend | NestJS, Prisma | REST API, webhooks, business logic |
| Worker | Python 3.11 | SQS consumers for email, payments, CME PDFs |
| Database | PostgreSQL (RDS) | Users, programs, enrollments, payments, sessions |
| Auth | Supabase / GoTrue (MediaHub) | OAuth and JWT; sessions stored in Postgres |
| Queue | SQS | Decouple long-running work from API requests |
| Email | Amazon SES | Transactional mail |
| CDN | CloudFront + S3 | Static frontend assets |

## Key flows

### Session completion → payment

1. HCP attends a live session; Zoom webhooks record join/leave events.
2. HCP submits a JotForm post-event survey; webhook creates a `SurveyResponse`.
3. When attendance + survey criteria pass, backend queues a payment job on SQS.
4. Python worker calls Bill.com; honorarium is paid and status is updated in Postgres.
5. CME certificate PDF is generated and emailed via SES when applicable.

### Admin program scheduling

Admin creates a webinar or office hours session via the scheduler UI. Backend calls Zoom API, stores the `Program` in Postgres, and sends calendar invites. Optional: clone a JotForm survey template and attach it to the program.

### Content catalog

Frontend and backend fetch public MediaHub API content for disease-area playlists, KOL clips, and biomarker rows. YouTube playlists supplement podcast/audio content.

## Environments

| Environment | URL | Terraform |
|-------------|-----|-----------|
| Staging | `staging.testapp.communityhealth.media` | `us-east-1-staging` |
| Platform (prod) | `testapp.communityhealth.media` | `us-east-1` |

Both run in AWS account `233636046512`, region `us-east-1`. Account-level security services (GuardDuty, AWS Config) are managed only from the platform stack.

## Health checks

- `GET /health` — liveness
- `GET /health/ready` — Postgres connectivity (used by deploy workflows)
