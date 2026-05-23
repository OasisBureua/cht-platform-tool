# CI/CD

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-validation.yml` | Pull requests | Lint, test, Terraform validate |
| `deploy-staging.yml` | Push to `staging`, `feature/**` | Deploy to staging |
| `deploy-prod.yml` | Push to `release/**`, `v*` tags, manual | Deploy to platform (prod) |
| `rollback.yml` | Manual | Roll back ECS services |

Docs-only changes under `docs/**` do not trigger deploy workflows.

## Staging

- **Environment:** `staging` (GitHub Environment secrets)
- **Domain:** `staging.testapp.communityhealth.media`
- **Terraform:** `infrastructure/terraform/environments/us-east-1-staging`

## Platform (production)

- **Environment:** `platform` (GitHub Environment secrets)
- **Domain:** `testapp.communityhealth.media`
- **Terraform:** `infrastructure/terraform/environments/us-east-1`
- **Image tags:** git tag name on `v*` pushes; otherwise `platform-{sha}-{timestamp}`

Configure the `platform` environment with deployment branch rules for `release/**` and copy secrets from the legacy `production` environment if migrating.

## Local verification

```bash
./verify.sh                    # mirrors PR validation checks
./scripts/verify-github-env-secrets.sh STAGING
./scripts/verify-github-env-secrets.sh PRODUCTION
./smoke.sh https://staging.testapp.communityhealth.media
```

## Manual deploy

```bash
./scripts/deploy-primary.sh platform
```

See [docs/engineering/deployment.md](../docs/engineering/deployment.md) for the full release flow.
