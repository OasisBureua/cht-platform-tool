# Platform Consolidation (Single Account)

The infrastructure is consolidated to a single account using `platform.tfvars`.

## Changes

- **Config:** `platform.tfvars` – single config with `environment = "platform"`
- **Domain:** `testapp.communityhealth.media` (single domain, no app./api. subdomains)
- **Routing:** CloudFront path-based – `/api/*` and `/health/*` → ALB, `/*` → S3 frontend
- **Capacity:** 600 users (non-simultaneous) – db.t3.small, cache.t3.small
- **State bucket:** `cht-platform-terraform-state`
- **Deploy:** `./scripts/deploy-primary.sh platform` (or `./scripts/deploy-primary.sh` – platform is default)
- **Verify:** `./scripts/verify-platform.sh`

## First-Time Setup (New State Bucket)

If you don't have the state bucket yet:

```bash
aws s3 mb s3://cht-platform-terraform-state --region us-east-1
aws s3api put-bucket-versioning --bucket cht-platform-terraform-state \
  --versioning-configuration Status=Enabled
```

Create the DynamoDB table for locking (if not exists):

```bash
aws dynamodb create-table \
  --table-name cht-platform-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Migrating from dev.tfvars

If you have existing state in `cht-platform-terraform-state-dev`:

1. Copy state to the new bucket, or
2. Keep using the dev bucket by editing `main.tf` backend to use `cht-platform-terraform-state-dev`

## Deploy

```bash
./scripts/verify-platform.sh
./scripts/deploy-primary.sh platform
```
