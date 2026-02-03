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
- SendGrid (Email)
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
