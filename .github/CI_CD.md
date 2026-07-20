# CI/CD

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `pr-validation.yml` | Pull requests | Lint, build, Terraform validate |
| `branch-policy.yml` | PRs → `main` | Require head branch `release/*` or `hotfix/*` |
| `security-monthly.yml` | First Monday monthly | npm audit, Trivy filesystem scan |
| `deploy-dev.yml` | Push to `develop` or `feature/**` (app/infra paths), manual | Build images (`1.0.0`, `1.0.1`, …) → `cht-dev-*` ECR, Terraform apply dev |
| `deploy-prod.yml` | Manual or merged `release/*` or `hotfix/*` → `main` | App deploy → `cht-platform-*` ECR (`v1.0.0`, `v1.0.1`, …), Terraform apply platform, frontend |
| `rollback.yml` | Manual | Roll back ECS services |

Dependabot and CodeQL config files are removed for now. Optional: disable GitHub **default CodeQL** under Settings → Code security → Code scanning if PR scans still appear.

Docs-only changes under `docs/**` do not trigger dev deploy.

## Branch flow (main ← release or hotfix)

GitHub **rulesets alone cannot** restrict which source branch merges into `main`. Use **rulesets + required status check**:

### 1. Ruleset — protect `main`

Repo → **Settings → Rules → Rulesets → New branch ruleset**

| Setting | Value |
|---------|--------|
| Name | `Protect main` |
| Enforcement | Active |
| Target branches | `main` (default branch) |
| Restrict deletions | ✓ |
| Block force pushes | ✓ |
| Require a pull request | ✓ (1 approval, optional code owners) |
| Require status checks | ✓ — add **`main-from-release-only`** and **`release-contains-develop`** (after first workflow run; `release-contains-develop` only runs for `release/*`) |
| Require branches up to date | ✓ (recommended) |

Do **not** allow broad bypass on this ruleset.

**Hotfixes:** PRs from `hotfix/*` → `main` are allowed by `branch-policy.yml` and trigger `deploy-prod.yml` the same way as `release/*`. Hotfixes do **not** need to contain `develop`.

**Status checks (important):** GitHub only lets you pick checks that have **run at least once** on the repo. Until then:

1. Save the ruleset **without** “Require status checks”, **or**
2. Run workflows once (`workflow_dispatch` on **Branch policy** + merge a test PR), then edit the ruleset and add:

| Check name (exact) |
|--------------------|
| `main-from-release-only` |
| `release-contains-develop` |

Optional: also require **PR Validation / Validate PR** from `pr-validation.yml`.

### 2. Ruleset — protect `release/*`

New ruleset:

| Setting | Value |
|---------|--------|
| Name | `Protect release branches` |
| Target branches | `release/**` |
| Restrict deletions | ✓ |
| Block force pushes | ✓ |
| Require a pull request | ✓ (for merges between release branches if needed) |
| Restrict updates | Optional — limit who can push directly to `release/*` |

**Creating `release/*` from `main`:** GitHub has no single “must branch off main” toggle. Enforce with:

- Team process: `git checkout develop && git pull && git checkout -b release/v1.0.0`
- CI job **`release-contains-develop`** (in `branch-policy.yml`) on PRs to `main`

### 3. Recommended git flow (matches Content Hub)

```text
feature/*  →  dev  (integrate + deploy dev via deploy-dev.yml)
       ↓
    main     (stable — PRs from release/* or hotfix/*)
       ↓
release/vX.Y.Z  (cut from main → platform deploy)
       ↓
 PR release/* → main  (after prod validated)
```

For CHT dev deploys: push to `develop` or `feature/**` triggers `deploy-dev.yml` (or run manually).

### 4. Optional — block direct pushes to main

In the `main` ruleset, ensure **Restrict updates** is on so nobody pushes to `main` without a PR (except bypass actors you trust).

## Development deploy

- **Environment:** `development` (GitHub Environment secrets)
- **Domain:** `devapp.communityhealth.media`
- **Terraform:** `infrastructure/terraform/environments/us-east-1`
- **Var file (CI):** `infrastructure/terraform/environments/variables/dev.github.tfvars`
- **Image tags:** semver `1.0.0`, `1.0.1`, … (auto-increment patch); also `dev-latest`
- **ECR repos:** `cht-dev-backend`, `cht-dev-worker`

Sync secrets into the `development` environment:

```bash
./scripts/sync-github-secrets-from-tfvars.sh development
./scripts/verify-github-env-secrets.sh development
```

## Platform (production / testapp)

- **Environment:** `platform` (GitHub Environment secrets)
- **Domain:** `testapp.communityhealth.media`
- **Var file (CI):** `infrastructure/terraform/environments/variables/platform.github.tfvars`
- **Infra + app (CI):** `deploy-prod.yml` — ECR images, Terraform plan/apply (manual approval), frontend S3/CloudFront
- **Infra (local fallback):** `./scripts/deploy-platform-infra-local.sh` when applying outside CI
- **Content Hub:** separate `cht-content-hub` repo; CHT only configures `contenthub_base_url` + `CONTENTHUB_API_KEY`
- **Image tags:** semver `v1.0.0`, `v1.0.1`, …; also `platform-latest`
- **ECR repos:** `cht-platform-backend`, `cht-platform-worker`

Configure the `platform` environment with deployment branch rules for `release/**`.

```bash
./scripts/verify-github-env-secrets.sh platform
# Optional local infra:
# ./scripts/deploy-platform-infra-local.sh
# ./scripts/sync-github-secrets-from-tfvars.sh platform
```

## Local verification

```bash
./scripts/verify.sh
./scripts/verify-github-env-secrets.sh development
./smoke.sh https://devapp.communityhealth.media
```

## Manual deploy

```bash
./scripts/deploy-primary.sh dev
./scripts/deploy-frontend.sh dev
./scripts/deploy-primary.sh platform   # prod
```

See [docs/engineering/deployment.md](../docs/engineering/deployment.md) for the full release flow.
