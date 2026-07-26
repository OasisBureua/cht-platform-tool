# Disaster Recovery Plan

Recovery procedures for the CHT Platform when infrastructure or data must be restored after failure, corruption, or region-level disruption.

**Primary region:** `us-east-1`  
**AWS account:** `233636046512`  
**Standby:** `us-east-2` Terraform exists (`infrastructure/terraform/environments/us-east-2`) but is **not deployed by default**, failover is manual.

**Last reviewed:** _Set date when approved_

---

## Recovery objectives

| Metric | Platform (prod) | Dev | Notes |
|--------|-----------------|---------|-------|
| **RPO** (max data loss) | **24 hours** | **24 hours** | Automated daily RDS snapshots; finer RPO requires increasing backup retention / PITR window |
| **RTO** (max downtime) | **4 hours** | **8 hours** | Single-region, no hot standby; depends on engineer availability |
| **RTO (region failover)** | **24+ hours** | N/A | Requires deploying `us-east-2` stack and DNS cutover: not automated |

These targets are **goals** for planning and audits. Update after architecture changes (e.g. Multi-AZ RDS, active DR region).

---

## What is protected automatically

| Asset | Protection | Config (platform) |
|-------|------------|-------------------|
| **RDS PostgreSQL** | Automated daily backups + snapshots | `cht-platform-db`, retention **7 days**, window **03:00–04:00 UTC** |
| **RDS** | Encryption at rest (KMS), deletion protection | `deletion_protection = true` |
| **RDS** | Final snapshot on delete | `cht-platform-final-snapshot` |
| **Terraform state** | S3 versioning + encryption | `cht-platform-terraform-state` |
| **Frontend** | S3 + CloudFront; redeploy from CI | Versioned build artifacts in workflow |
| **Container images** | ECR tagged images | Tags: `v*`, `platform-{sha}-{timestamp}`, `staging-latest` |
| **Secrets** | AWS Secrets Manager | Rotated via Terraform + GitHub Environment secrets |
| **Audit logs** | CloudTrail, VPC flow, ECS logs | 365-day retention (platform/staging) |

**Staging:** `cht-platform-dev-db` with **1-day** backup retention (`dev.tfvars`).

**Point-in-time recovery (PITR):** Available while `backup_retention_period > 0`. Restores to any second within the retention window (platform: last 7 days).

---

## Environment reference

### Platform (production)

| Resource | Name |
|----------|------|
| Domain | `testapp.communityhealth.media` |
| ECS cluster | `cht-platform-cluster` |
| Backend service | `cht-platform-backend` |
| Worker service | `cht-platform-worker` |
| RDS instance | `cht-platform-db` |
| Health check | `https://testapp.communityhealth.media/health/ready` |
| ECR images | `cht-platform-backend`, `cht-platform-worker` |

### Staging

| Resource | Name |
|----------|------|
| Domain | `devapp.communityhealth.media` |
| ECS cluster | `cht-dev-cluster` |
| Backend service | `cht-dev-backend` |
| Worker service | `cht-dev-worker` |
| RDS instance | `cht-staging-db` |
| Health check | `https://devapp.communityhealth.media/health/ready` |

---

## Scenario 1: Application failure (ECS / bad deploy)

**Symptoms:** Health check failing, 5xx from ALB, recent deploy.

**RTO:** ~15–30 minutes.

### Option A: GitHub Actions rollback (preferred)

1. GitHub → **Actions** → **Rollback Deployment** → Run workflow.
2. **Environment:** `platform` or `dev`.
3. **Image tag:** Last known-good tag (e.g. `v2.1.6` or `platform-abc1234-1234567890` from ECR/Actions history).
4. Workflow updates ECS task definitions and waits for stability.
5. Verify:
   ```bash
   ./smoke.sh https://testapp.communityhealth.media
   ```

### Option B: Redeploy previous release

1. Re-run a successful **Deploy to Platform** workflow from Actions history, or
2. Push the previous `v*` tag, or
3. Push to the last good `release/**` branch commit.

### Option C: AWS CLI (manual)

```bash
# List recent task definitions
aws ecs list-task-definitions --family-prefix cht-platform-backend --sort DESC --max-items 5

# Update service to previous revision (replace REVISION)
aws ecs update-service \
  --cluster cht-platform-cluster \
  --service cht-platform-backend \
  --task-definition cht-platform-backend:REVISION \
  --force-new-deployment

# Repeat for cht-platform-worker
```

---

## Scenario 2: Database failure or corruption

**Symptoms:** `/health/ready` database check fails, RDS instance unavailable, bad migration, accidental data delete.

**RPO:** Up to 24 hours for snapshot restore; **minutes** if PITR within retention window.

**RTO:** 1–3 hours (restore + validation).

### Step 1: Assess

1. RDS console → **Databases** → `cht-platform-db` → Monitoring / Events.
2. Decide:
   - **Instance failure:** Reboot or AWS support case.
   - **Logical corruption / bad migration:** Restore snapshot or PITR to **new** instance.
   - **Accidental delete:** PITR to time before delete.

### Step 2: Stop writes (if corruption suspected)

1. Scale backend desired count to **0** (ECS console or CLI) to prevent further writes.
2. Notify incident commander (see [incident-response.md](./incident-response.md)).

### Step 3: Restore from snapshot

1. RDS → **Snapshots** → select automated or manual snapshot → **Restore snapshot**.
2. New identifier example: `cht-platform-db-restored-YYYYMMDD`.
3. Use same VPC subnet group and security group as original (`cht-platform-rds-sg`).
4. **Do not** delete original instance until restore is validated.

### Step 4: Point-in-time restore (preferred when time of failure is known)

1. RDS → `cht-platform-db` → **Actions** → **Restore to point in time**.
2. Choose target time **just before** the incident.
3. New instance identifier as above.

### Step 5: Reconnect application

1. Update `DATABASE_URL` in Secrets Manager to the restored endpoint (or update Terraform to point to new instance and apply, coordinate carefully).
2. Run migrations only if restoring to **empty** DB or known schema state:
   ```bash
   # Via ECS Exec on backend task (see deploy workflow pattern)
   npx prisma migrate deploy
   ```
3. Scale ECS services back to desired count.
4. Validate health, login, sample admin read, payment queue depth.

### Step 6: Post-restore

- Root-cause analysis and postmortem.
- If original instance is retired, update Terraform to manage the new identifier or swap identifiers per AWS guidance.

**Get DB password:** Stored in Secrets Manager (Terraform-managed), not in git.

---

## Scenario 3: Frontend / CDN failure

**Symptoms:** Site blank or stale; API healthy.

**RTO:** ~15 minutes.

1. Re-run deploy workflow (frontend build + S3 sync + CloudFront invalidation).
2. Or manually invalidate CloudFront distribution and re-upload from last green Actions artifact.
3. Verify `https://testapp.communityhealth.media/` and static assets.

---

## Scenario 4: SQS / worker backlog or DLQ

**Symptoms:** DLQ CloudWatch alarms; emails or payments not processing.

**RPO:** Messages retained in DLQ (14-day default SQS retention: confirm in Terraform).

1. Fix underlying bug or credential issue in worker.
2. Inspect DLQ messages in SQS console (payment DLQ: **manual review** before replay).
3. Redrive messages to source queue or re-process after fix.
4. Confirm worker service healthy: `cht-platform-worker` on `cht-platform-cluster`.

---

## Scenario 5: Secrets compromise

Follow [incident-response.md](./incident-response.md#aws-lockdown-checklist), then:

1. Rotate secrets in GitHub Environment + Terraform tfvars.
2. `terraform apply` to push new values to Secrets Manager.
3. Force ECS service redeployment to pick up new secret versions.

---

## Scenario 6: Full region loss (`us-east-1`)

**Not automated.** Documented for completeness.

1. Declare disaster; incident commander activates DR plan.
2. Deploy `us-east-2` infrastructure from `infrastructure/terraform/environments/us-east-2` (requires state bucket, AMIs/images in region, DNS updates).
3. Restore RDS from cross-region snapshot copy (must be configured **in advance**, not currently in default stack).
4. Update Route53 / DNS to point `testapp.communityhealth.media` to DR ALB/CloudFront.
5. Reconfigure GitHub secrets and vendor webhooks to DR URLs.

**Action item for lower RTO:** Implement cross-region RDS snapshot copies and periodic DR drills.

---

## Testing and evidence (SOC 2)

| Activity | Frequency | Evidence |
|----------|-----------|----------|
| Review backup retention and last successful snapshot | Monthly | RDS console screenshot or CLI |
| Restore drill (staging snapshot → test instance) | **Annually** | Postmortem / ticket with restore time |
| Rollback drill (ECS to previous tag) | **Annually** | Actions run link |
| Update RTO/RPO if architecture changes | As needed | This doc revision history |

---

## Useful commands

```bash
# Health
curl -sf https://testapp.communityhealth.media/health/ready | jq .
curl -sf https://devapp.communityhealth.media/health/ready | jq .

# ECS service status
aws ecs describe-services \
  --cluster cht-platform-cluster \
  --services cht-platform-backend cht-platform-worker \
  --query 'services[*].{name:serviceName,status:status,running:runningCount,taskDef:taskDefinition}'

# List RDS snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier cht-platform-db \
  --query 'DBSnapshots[*].{Id:DBSnapshotIdentifier,Time:SnapshotCreateTime,Status:Status}' \
  --output table

# Recent automated backups
aws rds describe-db-instance-automated-backups \
  --db-instance-identifier cht-platform-db
```

---

## Related documents

- [incident-response.md](./incident-response.md): Escalation and lockdown
- [../engineering/deployment.md](../engineering/deployment.md): Normal release process
- [../../.github/workflows/rollback.yml](../../.github/workflows/rollback.yml): Automated ECS rollback
