# Deployment

## Environments


| Name            | GitHub Environment | Domain                          | Workflow          |
| --------------- | ------------------ | ------------------------------- | ----------------- |
| Dev             | `dev`              | `devapp.communityhealth.media`  | `deploy-dev.yml`  |
| Platform (prod) | `platform`         | `testapp.communityhealth.media` | `deploy-prod.yml` |


AWS region: `us-east-1`. ECR registry: `233636046512.dkr.ecr.us-east-1.amazonaws.com`.

## Automatic deploys (GitHub Actions)

### Staging

Triggers on push to `dev` or `feature/**` branches (docs-only changes are ignored).

1. Run tests (backend, frontend, Terraform validate)
2. Build and push Docker images to ECR
3. Terraform apply (`dev.tfvars`)
4. Run database migrations via ECS Exec
5. Deploy frontend to S3 + CloudFront invalidation
6. Health checks against public URLs

### Platform (production)

Triggers on:

- Push to `release/**` branches
- Push of `v*` tags (image tagged with the git tag, e.g. `v2.1.6`)
- Manual `workflow_dispatch`

Does **not** deploy on push to `main`. Use a release branch or tag when promoting to prod.

1. Same build/test/terraform/migrate/frontend flow as staging
2. Uses `platform` GitHub Environment (configure branch protection for `release/`**)
3. Terraform plan → manual approval issue → apply (same pattern as deploy-dev)
4. Health gate: `/health/ready`, `/health`, `/` on `APP_URL`

Concurrency group `deploy-platform`: overlapping prod deploys are queued, not cancelled.

## Manual deploy (Terraform)

For infrastructure changes outside CI, or emergency applies:

```bash
# Platform (prod): default
./scripts/deploy-primary.sh platform

# Dev stack
./scripts/deploy-primary.sh dev
```

Variable files live in `infrastructure/terraform/environments/variables/`.

## GitHub secrets

Deploy workflows read secrets from GitHub Environments (`dev`, `platform`). Verify before a deploy:

```bash
./scripts/verify-github-env-secrets.sh DEV
./scripts/verify-github-env-secrets.sh PRODUCTION   # platform env
```

Missing secrets become empty strings in AWS Secrets Manager and break integrations at runtime.

## Database migrations

Migrations run automatically in deploy workflows via ECS Exec on the backend task. To run locally against a remote DB, use the migration script or connect with `DATABASE_URL` from Secrets Manager (requires VPN/bastion if RDS is private).

## Post-deploy smoke test

```bash
./smoke.sh https://testapp.communityhealth.media
./smoke.sh https://devapp.communityhealth.media
```

## Rollback

Redeploy a known-good image tag:

1. GitHub Actions → **Deploy to Platform** → Run workflow, or
2. Push an existing `v`* tag, or
3. Re-run a successful workflow run from the Actions history

For frontend-only rollback, redeploy the previous S3 artifact from the workflow run or re-run the deploy job for the last good commit.

## Release flow (recommended)

1. Merge feature work to `dev` or a `feature/*` branch → auto-deploy to staging
2. Validate on staging (login, surveys, admin, earnings)
3. Create `release/vX.Y.Z` branch → deploys to platform
4. Tag `vX.Y.Z` on that commit for a semver Docker image tag
5. Merge release branch to `main` when stable

