# CHT Platform

Healthcare education platform connecting medical professionals with CME programs and honorarium payments.

## Project Structure
```
cht-platform/
├── backend/          # NestJS API server
├── worker/           # Python background workers
├── frontend/         # React web application
├── infrastructure/   # Terraform IaC
├── docs/            # Documentation
└── scripts/         # Deployment scripts
```

## Tech Stack

### Backend
- NestJS (TypeScript)
- PostgreSQL + Prisma ORM
- Auth0 (Authentication)
- Stripe Connect (Payments)
- AWS SQS (Job queuing)

### Worker
- Python 3.11
- Boto3 (AWS SDK)
- Amazon SES (Email)
- ReportLab (PDF generation)

### Frontend
- React 18 + TypeScript
- Vite (Build tool)
- Tailwind CSS
- React Query
- Recharts

### Infrastructure
- AWS (ECS, RDS, ElastiCache, SQS, S3, CloudFront)
- Terraform
- Docker

## Getting Started

See [docs/getting-started.md](docs/getting-started.md)

## Architecture

See [docs/architecture.md](docs/architecture.md)

## Deployment

See [docs/deployment.md](docs/deployment.md)

## Local development helpers

Two optional scripts for developers who want to catch problems before CI does:

```bash
./verify.sh           # runs typecheck + lint + tests across frontend + backend
./verify.sh frontend  # frontend only
./verify.sh backend   # backend only

./smoke.sh                                        # defaults to testapp
./smoke.sh https://testapp.communityhealth.media  # explicit
```

`verify.sh` mirrors the checks in `.github/workflows/pr-validation.yml` so you
can find failures locally in ~60 seconds rather than after a failed PR check.
`smoke.sh` hits health endpoints and critical public pages post-deploy to
confirm nothing obvious is broken.

Both scripts are optional — the GitHub Actions workflows remain the source of truth.
