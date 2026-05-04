# us-east-1 Staging Infrastructure

## Purpose

Isolated staging environment for testing infra changes, schema migrations, and feature work before promoting to `testapp.communityhealth.media`.

- **Domain:** `staging.testapp.communityhealth.media`
- **Cost target:** ~$80-100/month (smaller resource sizing than dev)
- **State key:** `us-east-1-staging/terraform.tfstate` in `cht-platform-terraform-state` bucket
- **VPC CIDR:** `10.1.0.0/16` (dev uses `10.0.0.0/16` — non-overlapping for future peering)

## Relationship to dev (us-east-1) and us-east-2

| Environment | Directory | Purpose | Domain | Status |
|---|---|---|---|---|
| dev | `us-east-1/` | Existing testapp environment | `testapp.communityhealth.media` | ✅ Live |
| **staging** | `us-east-1-staging/` | **NEW — this directory** | `staging.testapp.communityhealth.media` | 🚧 Being deployed |
| failover | `us-east-2/` | Stub for disaster recovery | `testapp.communityhealth.media` (via DNS swap) | 📦 Code stub only |

Staging is a **sibling** of dev, NOT a copy — different ECS cluster, RDS instance, Redis, S3 buckets, CloudFront distribution.

## Deploy

Pushing to the `staging` branch triggers `.github/workflows/deploy-staging.yml`.

For manual deploys (rare):
```bash
cd infrastructure/terraform/environments/us-east-1-staging

terraform init
terraform plan -var-file=../variables/staging.tfvars
terraform apply -var-file=../variables/staging.tfvars
```

The `staging.tfvars` file is gitignored; use `staging.tfvars.example` as a template and fill values from the testapp secrets source.

## SSL Certificate

Reuses the existing wildcard cert `*.testapp.communityhealth.media` (ARN `3d4f17ef-46f3-45a2-84a0-c61fb94769bb`). No new cert needed.

## Auth

Backend points at the same MediaHub-hosted GoTrue (`mediahub.communityhealth.media/auth/v1`) as dev. The `GOTRUE_JWT_SECRET` is shared across environments by design.

For OAuth (Google/Apple) sign-in to work on staging, the GoTrue Redirect URLs allowlist must include:
- `https://staging.testapp.communityhealth.media/auth/callback`

This is a one-time MediaHub admin task, not blocking the first deploy (password login works without it).

## Teardown

If staging needs to come down:
```bash
cd infrastructure/terraform/environments/us-east-1-staging
terraform destroy -var-file=../variables/staging.tfvars
```

Tear down only after confirming no other engineer is using staging.

## What this environment is NOT

- Not a developer sandbox (use local dev for individual feature work)
- Not a prod replica with real user data (synthetic seed only — no PHI/PII)
- Not high-availability (single-AZ, single task each — outages expected during deploys)
