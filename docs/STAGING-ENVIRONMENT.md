# Staging Environment

A second, isolated copy of the CHT Platform stack — separate ECS, RDS, Redis, S3, CloudFront — for testing changes before they hit `testapp.communityhealth.media`.

- **URL:** `https://staging.testapp.communityhealth.media`
- **API:** `https://staging.testapp.communityhealth.media/api`
- **Trigger:** push to the `staging` branch auto-deploys
- **Cost:** ~$80-100/month

---

## TL;DR for developers

You have a feature branch you want to test on a real deployed stack:

```bash
# 1. Get up to date
git checkout staging
git pull origin staging

# 2. Bring your feature in (merge or rebase your branch)
git merge feat/my-feature-branch       # OR: git rebase staging in your branch then push

# 3. Push — auto-deploys
git push origin staging
```

That's it. The deploy workflow will:
1. Build backend + worker Docker images (~3 min)
2. Apply Terraform (only updates what changed; usually fast)
3. Build frontend, upload to S3, invalidate CloudFront (~2 min)
4. Smoke-test `/health/ready`

**Total: ~10 minutes wall time.** Watch progress at GitHub → Actions → "Deploy to Staging".

When green: visit `https://staging.testapp.communityhealth.media` and test.

---

## Common workflows

### Test a feature branch on staging

```bash
git checkout staging && git pull
git merge feat/my-thing
git push origin staging
```

### Test a schema migration on staging

Before pushing to `staging`:

1. Author your migration locally: `cd backend && npx prisma migrate dev --name describe_change`
2. Push the migration commit to your feature branch first, get it into staging via the merge above
3. The deploy will run the migration automatically as part of the backend container's startup
4. Verify: hit the API, check that the new column/table works
5. **Only after** staging looks good → merge your feature branch into `main`

This is THE main reason staging exists. Always do migrations through staging first.

### Roll back staging to a known-good state

```bash
git checkout staging
git reset --hard <last-known-good-commit-sha>
git push origin staging --force-with-lease
```

The deploy will re-run with the older code. Use `--force-with-lease` not `--force` to avoid clobbering teammate pushes.

### Test something on staging without merging into staging branch

Trigger a manual deploy on any branch:

GitHub → Actions → "Deploy to Staging" → "Run workflow" → pick your branch → run.

This deploys that branch's code to staging without touching the `staging` branch. Useful for quick smoke tests on PR branches.

### Tail logs

```bash
aws logs tail /ecs/cht-platform-staging-cluster --follow
```

Or per-task in CloudWatch.

### Connect to the staging database

The RDS instance is in a private VPC. Use ECS Exec into a backend task:

```bash
# Find a running backend task
aws ecs list-tasks --cluster cht-platform-staging-cluster --service-name cht-platform-staging-backend

# Exec in
aws ecs execute-command \
  --cluster cht-platform-staging-cluster \
  --task <task-id-from-above> \
  --container backend \
  --interactive \
  --command "/bin/sh"

# Inside the container
npx prisma studio       # browse data
npx prisma migrate status
psql $DATABASE_URL      # raw SQL
```

---

## What staging is for

- Testing Prisma schema migrations on a real Postgres before they hit testapp
- Validating integration changes (MediaHub API, GoTrue auth, Bill.com sandbox, Zoom)
- Running end-to-end test flows (signup → webinar registration → survey → honorarium) on a real stack
- Previewing in-progress feature work for team review
- Light load testing without touching customer environment

## What staging is NOT

- **Not a developer sandbox.** For individual feature dev, run locally (`backend/`, `frontend/` with `VITE_USE_DEV_AUTH=true`). Don't push every WIP commit to staging.
- **Not a prod replica with real user data.** Synthetic seed only — no PHI/PII. Real users do not exist here.
- **Not high availability.** Single-AZ, 1 ECS task per service, occasional downtime expected during deploys.
- **Not a long-lived test branch.** The `staging` branch should track recent feature work, not diverge for weeks. Merge to main regularly so staging doesn't drift.

## What NOT to do

Avoid:

- ❌ Pushing untested destructive migrations (DROP TABLE, etc.) to `staging` without coordination — staging is a real Postgres instance and others may be testing against it
- ❌ `git push --force` to staging without `--force-with-lease` (can clobber teammate work)
- ❌ Treating staging like prod — its data can be wiped any time, don't store anything important here
- ❌ Hardcoding the staging URL anywhere outside test/dev configs (the URL changes when shield drops and prod naming changes)

If unsure: **ask in #cht-platform Slack before pushing risky changes to staging**.

---

## Branching model

| Branch | Deploys to | Purpose |
|---|---|---|
| `main` | testapp.communityhealth.media (current dev/pseudo-prod) | The shipping branch |
| `staging` | staging.testapp.communityhealth.media | Pre-flight testing of changes before they hit `main` |
| feature branches | nothing (PR validation only) | Individual work, tested locally |

Workflow:
1. Build feature on a branch (`feat/my-thing`)
2. Test locally with dev bypass auth or against shared dev Postgres
3. When ready to test against the real stack: merge into `staging`, push, watch deploy
4. When staging passes: open PR `feat/my-thing` → `main`
5. After PR review + merge to `main`: testapp deploys via the existing dev workflow

You don't need a separate PR-to-staging step. Just merge into the `staging` branch directly to test.

---

## Coordination tips

- Multiple developers can use staging simultaneously. The state machine is the same as testapp.
- If you're running a destructive test (wiping the DB, etc.) — say so in Slack first.
- The `staging` branch can be force-rebased onto `main` periodically to keep it close to shipping code. Coordinate before doing this.
- When testing a schema migration: announce it in Slack so a teammate's in-flight test doesn't get surprised.

---

## Operator details (for infra changes)

### Manual deploy from CLI (rare — emergencies only)

```bash
cd infrastructure/terraform/environments/us-east-1-staging
terraform init
terraform plan -var-file=../variables/staging.tfvars
terraform apply -var-file=../variables/staging.tfvars
```

`staging.tfvars` is gitignored. Use `staging.tfvars.example` as template; fill values from `~/Downloads/testapp secrets` or AWS Secrets Manager.

### Smoke test

```bash
./smoke.sh https://staging.testapp.communityhealth.media
```

Or:
```bash
curl -f https://staging.testapp.communityhealth.media/health/ready
curl -f https://staging.testapp.communityhealth.media/api/health/ready
```

### Auth & GoTrue allowlist

Backend points at the same MediaHub-hosted GoTrue (`https://mediahub.communityhealth.media/auth/v1`) as testapp.

For OAuth (Google/Apple) sign-in to work, GoTrue's Redirect URLs allowlist must include:

```
https://staging.testapp.communityhealth.media/auth/callback
```

Password login works without this. OAuth setup is a one-time MediaHub admin task.

### State, region, infrastructure

- **Region:** us-east-1
- **State:** `s3://cht-platform-terraform-state/us-east-1-staging/terraform.tfstate`
- **VPC CIDR:** `10.1.0.0/16` (testapp uses `10.0.0.0/16` — non-overlapping for future peering)
- **SSL cert:** reuses existing wildcard `*.testapp.communityhealth.media`
- **Resources:** all prefixed `cht-platform-staging-*` (visible in AWS Console with that filter)

### Cost monitoring

Target: ~$80-100/month. CloudWatch billing alarm at $150 threshold.

Major drivers:
- NAT Gateway: ~$32/mo
- RDS db.t3.micro: ~$13/mo
- ElastiCache cache.t3.micro: ~$11/mo
- ALB: ~$16/mo
- ECS Fargate: ~$10-15/mo
- CloudFront/S3/KMS/Secrets: ~$3-8/mo

If costs exceed $150/mo, audit ECS task counts and NAT egress.

### Teardown

If staging needs to come down (cost reduction, broken state, etc.):

```bash
cd infrastructure/terraform/environments/us-east-1-staging
terraform destroy -var-file=../variables/staging.tfvars
```

**Warn the team in #cht-platform Slack first** — others may be using staging.

---

## Troubleshooting

### Deploy fails at "Terraform Init"

Check that `cht-platform-terraform-state` bucket exists and the OIDC role has read/write. State key is `us-east-1-staging/terraform.tfstate`.

### Deploy fails at "Health Check"

Backend may have started but migration is still running. Tail logs:
```bash
aws logs tail /ecs/cht-platform-staging-cluster --follow
```

If the health check times out repeatedly, the backend container might be failing to start. Check the ECS service events:
```bash
aws ecs describe-services --cluster cht-platform-staging-cluster --services cht-platform-staging-backend
```

### CloudFront still serving stale frontend

Cache invalidation runs on every deploy but takes 5-10 minutes to propagate. If urgent:
```bash
aws cloudfront create-invalidation --distribution-id <ID> --paths "/*"
```

### "GoTrue redirects to MediaHub instead of staging"

The staging callback URL hasn't been added to GoTrue's allowlist. See `docs/GOTRUE-REDIRECT-FIX.md`.

### Push to `staging` doesn't trigger deploy

Check GitHub → Actions to see if the workflow ran. If it didn't:
- Confirm the push went to the `staging` branch (not a PR)
- Confirm the workflow file `.github/workflows/deploy-staging.yml` exists on the branch you pushed
- Check `Settings → Environments → staging` exists with required secrets

### Need to deploy a hotfix to staging while CI is failing

Use `workflow_dispatch` directly:

GitHub → Actions → "Deploy to Staging" → Run workflow → pick branch → run.

This bypasses the auto-trigger but still runs the same deploy workflow.

---

## Quick reference

| What | How |
|---|---|
| Push my code to staging | `git checkout staging && git merge feat/x && git push origin staging` |
| Test a one-off branch on staging | GitHub Actions → Deploy to Staging → Run workflow → pick branch |
| See deploy progress | GitHub Actions tab |
| See backend logs | `aws logs tail /ecs/cht-platform-staging-cluster --follow` |
| Connect to staging DB | `aws ecs execute-command` into a backend task |
| Smoke test | `./smoke.sh https://staging.testapp.communityhealth.media` |
| Rollback | `git reset --hard <good-sha> && git push --force-with-lease origin staging` |
| Cost dashboard | AWS Console → Billing → filter by `Environment = staging` tag |
