# Runbook: Staging environment teardown

Decommission the AWS **staging** stack and GitHub **staging** deploy path. Production is the only hosted environment until Phase 3 (stable dev).

**When to run:** Phase 1 — **after** [secrets-migration-staging-to-prod.md](./secrets-migration-staging-to-prod.md) is complete and signed off.

**Owner:** Uche Aduakaa  
**Reviewer:** Adaze Oviawe  
**Approved:** June 16, 2026 at 08:28 PM EDT

**AWS account:** `233636046512`  
**Region:** `us-east-1`  
**Terraform state:** `s3://cht-platform-terraform-state/us-east-1-staging/terraform.tfstate`

---

## Impact


| Removed                                 | Production impact if pre-flight skipped |
| --------------------------------------- | --------------------------------------- |
| `staging.testapp.communityhealth.media` | None if prod validated independently    |
| Staging RDS                             | **Data loss** — snapshot optional       |
| Staging ECS / ALB / SQS                 | None                                    |
| GitHub `staging` environment            | Staging deploys stop                    |
| `deploy-staging.yml` active path        | Feature branches no longer auto-deploy  |


**Rollback:** Staging destroy is **largely irreversible**. Re-creating staging requires full Terraform apply + secrets bootstrap (~hours).

---

## Pre-flight checklist

- [x] [secrets-migration-staging-to-prod.md](./secrets-migration-staging-to-prod.md) signed off
- [x] `./scripts/verify-github-secrets.sh platform` passes
- [x] No production monitoring/alerts point only at staging URLs
- [x] Team notified: staging URL will stop working
- [x] Optional: RDS snapshot (Step 1 below)

---

## Step 1 — Optional final RDS snapshot

Skip if staging data has no value.

```bash
aws rds create-db-snapshot \
  --db-instance-identifier cht-platform-staging-db \
  --db-snapshot-identifier cht-platform-staging-final-$(date +%Y%m%d) \
  --region us-east-1
```

Wait until status `available`:

```bash
aws rds describe-db-snapshots \
  --db-snapshot-identifier cht-platform-staging-final-$(date +%Y%m%d) \
  --region us-east-1 \
  --query 'DBSnapshots[0].Status'
```

- [x] Snapshot created (or explicitly skipped)

---

## Step 2 — Disable staging deploys

Staging workflow already has `DEPLOY_ENABLED: 'false'` and push triggers commented out. Confirm no accidental deploy during destroy:

- [x] No in-progress `Deploy to Staging` workflow runs
- [x] Team agrees not to re-enable staging deploys

Optional — archive workflow in repo (separate PR after destroy):

- Comment or remove `.github/workflows/deploy-staging.yml` push triggers permanently
- Add note at top: `ARCHIVED — staging destroyed YYYY-MM-DD`

---

## Step 3 — Terraform destroy

```bash
cd infrastructure/terraform/environments/us-east-1-staging
terraform init -reconfigure
terraform plan -destroy -var-file="../variables/staging.tfvars"
```

Review plan: expect ECS cluster, RDS, ALB, SQS queues, CloudFront/S3 frontend, security groups.

```bash
terraform destroy -var-file="../variables/staging.tfvars"
```

Type `yes` when prompted.

**If destroy fails:**


| Error                   | Action                                        |
| ----------------------- | --------------------------------------------- |
| RDS deletion protection | Disable in console or tfvars, re-plan         |
| Non-empty S3 bucket     | Empty bucket, retry                           |
| Dependency timeout      | Retry destroy; check ENI / ECS tasks draining |


- [x] `terraform destroy` completed successfully
- [x] State bucket entry empty or state file shows no resources

---

## Step 4 — Verify AWS cleanup

```bash
# Should return empty or NotFound
aws ecs list-clusters --region us-east-1 | grep staging || true
aws rds describe-db-instances --region us-east-1 | grep staging || true
```

- [x] No `cht-platform-staging-*` resources billing in AWS console (spot-check ECS, RDS, ALB, NAT)

---

## Step 5 — GitHub environment

1. Export secret **names** from staging environment (not values) for audit log.
2. Delete or archive GitHub Environment `staging` (Settings → Environments).

```bash
gh secret list --env staging   # document names before delete
```

- [x] Staging GitHub environment archived or removed

---

## Step 6 — DNS and documentation

- [x] Remove or repoint `staging.testapp.communityhealth.media` (Route53 / CloudFront) if record remains
- [x] Update [deployment.md](../engineering/deployment.md) — prod + local only
- [x] Update [architecture.md](../engineering/architecture.md) — remove staging row
- [x] Update [incident-response.md](../compliance/incident-response.md) — remove staging URLs from health checks
- [x] Update [disaster-recovery.md](../compliance/disaster-recovery.md) — remove staging RTO row

---

## Step 7 — Post-teardown validation

Production smoke test:

```bash
./scripts/smoke.sh https://testapp.communityhealth.media
```

- [x] Prod health checks pass
- [x] No deploy pipeline depends on staging environment

---

## Exit criteria

- [x] Staging AWS resources destroyed
- [x] Staging GitHub environment retired
- [x] Docs updated
- [x] Prod smoke test passes

**Next phase:** Phase 2 auth decoupling — see [CHT-Auth-Decoupling-Next-Steps-Report.md](../reports/CHT-Auth-Decoupling-Next-Steps-Report.md) and [CHM-Platform-Roadmap-Plan.md](../reports/CHM-Platform-Roadmap-Plan.md). Local docker-compose is the day-to-day dev path until Phase 3 stable dev.

---

## Rollback


| Scenario              | Action                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Destroyed by mistake  | Restore from RDS snapshot to new instance; re-run `terraform apply` on us-east-1-staging (hours) |
| Prod broken unrelated | Do not recreate staging as panic fix — fix prod directly                                         |


