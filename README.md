# CHT Platform

Healthcare Professional Engagement Platform - AI-powered content hub connecting KOLs and HCPs.

## Project Structure

```
cht-platform/
├── infrastructure/    # Terraform AWS infrastructure
├── backend/          # TBD
├── docs/             # Documentation
└── .github/
    └── workflows/    # CI/CD pipelines
```

## Tech Stack

- **Backend**: TBD
- **Database**: TBD
- **Infrastructure**: Terraform + AWS
- **CI/CD**: GitHub Actions

## Getting Started

Documentation coming soon...

## Status

- ✅ Repository created
- ⏳ Infrastructure setup in progress
- ⏳ Backend API coming soon

## 🏗️ Infrastructure

Complete AWS infrastructure setup using Terraform:

### Features
- **Compute**: ECS Fargate with auto-scaling
- **Database**: Aurora PostgreSQL Serverless v2 + Redis
- **Networking**: VPC, ALB, Security Groups
- **Storage**: S3 for uploads and logs
- **Security**: AWS Secrets Manager, IAM roles

### Setup
See [Infrastructure Setup Checklist](./infrastructure/AWS_SETUP_CHECKLIST.md) for detailed AWS deployment instructions.

**Note:** AWS credentials required. Infrastructure code is ready for deployment.

### Quick Start (When AWS Ready)
```bash
cd infrastructure/terraform
source .env.local
terraform init
terraform plan -var-file="variables/local.tfvars"
terraform apply -var-file="variables/local.tfvars"
```
