# Runbook: Aurora Global Database migration (platform only)

Migrate **platform** (`testapp.communityhealth.media`) from RDS PostgreSQL + cross-region read replica to **Aurora PostgreSQL Global Database** (Option 2 sizing). **Dev stays on RDS** in us-east-1.

**Target timeline:** ~2 weeks  
**Primary region:** us-east-1 (writer)  
**Secondary region:** us-east-2 (reader until failover)  
**Instance class (both regions):** `db.r6g.large` (minimum memory-optimized class for Aurora Global; `db.t4g.medium` is not supported)  
**Estimated DB cost:** ~$130–170/mo (vs ~$80/mo RDS today)

---

## Scope

| Environment | Database | Action |
|-------------|----------|--------|
| **dev** (`devapp.communityhealth.media`) | RDS `db.t3.micro` + us-east-2 read replica | **No change** |
| **platform** (`testapp.communityhealth.media`) | RDS `db.t3.small` Multi-AZ + us-east-2 replica | **Migrate to Aurora Global** |

**Out of scope for this migration (separate work):**

- CloudFront automatic `/api*` routing to DR (still manual `route_api_to_secondary` or future automation)
- Dev Aurora Global
- Application schema changes (Prisma stays PostgreSQL-compatible)

---

## Dev baseline (confirm before platform work)

Dev should remain **primary in us-east-1** after any DR drills:

| Check | Expected |
|-------|----------|
| Primary ECS `cht-dev-backend` / `cht-dev-worker` | `desired=1`, `running=1`, us-east-1 |
| RDS `cht-dev-db` | `available`, us-east-1, `db.t3.micro` |
| DR replica `cht-dr-use2-dev-db-replica` | `available`, replicating from `cht-dev-db` |
| CloudFront `/api*` | `ALB-API-PRIMARY` (us-east-1 ALB) |
| `GET /actuator/info` | `"region": "us-east-1"`, `"auth-provider": "cognito"` |
| `GET /health/ready` | `"status": "ok"`, database up |

Quick verification:

```bash
curl -sS https://devapp.communityhealth.media/actuator/info | jq '{region,"auth-provider"}'
curl -sS https://devapp.communityhealth.media/health/ready | jq '.status,.details.database.status'
aws ecs describe-services --cluster cht-dev-cluster --services cht-dev-backend \
  --region us-east-1 --query 'services[0].{running:runningCount,desired:desiredCount}'
```

---

## Target architecture (platform)

```
                    Aurora Global Cluster (cht-platform-global)
                    ├── Primary cluster (us-east-1): WRITER (db.t4g.medium)
                    └── Secondary cluster (us-east-2): READER (db.t4g.medium)

Primary ECS/worker  → writer endpoint (Secrets Manager, us-east-1)
DR ECS/worker       → reader endpoint (Secrets Manager, us-east-2), run_db_migrations=false
```

**Regional DB failover:** AWS managed Global failover (replaces `promote-read-replica` for platform).

**App traffic failover:** Still requires CloudFront `/api*` → us-east-2 ALB + ECS scale (unchanged).

---

## Two-week plan

### Week 1: Design, Terraform, empty Aurora

| Day | Work |
|-----|------|
| 1 | Approve this runbook; choose **DMS vs dump/restore** (decision gate below) |
| 1–2 | Add `modules/database/aurora-global` (global cluster, primary + secondary) |
| 2–3 | Wire **us-east-1 platform**: replace RDS module with Aurora primary; new tfvars |
| 3–4 | Wire **us-east-2 platform DR**: remove `aws_db_instance.replica`; attach secondary cluster |
| 4 | Update Secrets Manager shape (cluster endpoint, reader endpoint); CloudWatch alarms |
| 5 | `terraform apply` **empty** Aurora Global (primary + secondary), no cutover yet |

**Week 1 exit criteria:** Empty Aurora clusters exist; secrets documented; `terraform plan` clean; dev unchanged and healthy.

### Week 2: Migration, cutover, validation

| Day | Work |
|-----|------|
| 6–7 | Run migration (DMS CDC or dump/restore) into Aurora primary |
| 8 | Validate data (row counts, `_prisma_migrations`, login/session smoke on temp endpoint) |
| 9 | **Cutover window** on testapp: point secrets to Aurora writer; redeploy ECS primary + DR |
| 10 | Production smoke tests; monitor 24h |
| 11 | Snapshot + decommission old RDS; update DR runbooks |
| 12 | Planned Global failover drill (optional); document failback |

**Week 2 exit criteria:** Platform on Aurora Global; old RDS removed after snapshot; DR drill doc updated.

---

## Decision gate: DMS vs dump/restore

Choose before Week 1 Day 3 implementation details.

| | **AWS DMS** | **pg_dump / restore** |
|--|-------------|------------------------|
| Downtime | Minutes (stop writes, flip endpoint) | Often 15–60+ min read-only |
| Complexity | Higher (DMS instance, replication task) | Lower |
| Best for | Platform with active users | Small DB, maintenance window OK |
| Rollback | Keep RDS until lag=0 and validated | Keep RDS snapshot until validated |

**Decision:** **AWS DMS** (full-load-and-cdc). Task `cht-platform-rds-to-aurora` on replication instance `cht-platform-dms` (`dms.t3.medium`).

---

## Terraform work items (checklist)

### us-east-1 platform

- [ ] New Aurora Global module (or extend database module with `engine = aurora`)
- [ ] `aws_rds_global_cluster` + primary `aws_rds_cluster` + writer instance
- [ ] Aurora subnet group, SG (ECS backend + worker ingress)
- [ ] Aurora parameter groups (map logging / `pg_stat_statements` from current RDS params)
- [ ] KMS encryption aligned with `module.kms`
- [ ] Outputs: global cluster id, writer endpoint, reader endpoints
- [ ] Remove platform RDS from state after cutover (after snapshot)

### us-east-2 platform DR

- [ ] Remove platform `aws_db_instance.replica`
- [ ] Secondary `aws_rds_cluster` + reader instance on same global cluster
- [ ] DR database secret → **reader endpoint**
- [ ] ECS backend/worker unchanged except secret host; `run_db_migrations = false`

### platform.tfvars (new / replaced vars)

- [ ] `aurora_instance_class = "db.t4g.medium"`
- [ ] `aurora_engine_version` (Aurora PostgreSQL 15.x compatible with Prisma)
- [ ] `enable_aurora_global = true` (platform only)
- [ ] Retention aligned with `rds_backup_retention = 7`
- [ ] Keep `secondary_api_origin_domain`, `dr_acm_certificate_arn`, Cognito vars as today

---

## Cutover procedure (platform)

1. Announce maintenance window on testapp (if using dump/restore).
2. Stop writes: scale backend to 0 or enable maintenance banner (optional).
3. Complete migration (DMS lag=0 or final dump/restore).
4. Update `cht-platform-database-credentials` → Aurora **writer** cluster endpoint.
5. Update DR secret → Aurora **reader** endpoint (us-east-2).
6. Force new deployment: primary backend + worker (us-east-1), DR backend (us-east-2).
7. Smoke tests (see below).
8. Re-enable traffic / scale up.
9. Monitor CloudWatch (Aurora CPU, connections, `AuroraGlobalDBReplicationLag`).
10. After 24–48h stable: final RDS snapshot → delete old RDS instance.

---

## Smoke tests (post-cutover)

- [ ] `GET https://testapp.communityhealth.media/health/ready`: database up
- [ ] `GET /actuator/info`: region us-east-1, auth cognito
- [ ] Login (email + Cognito OAuth)
- [ ] `GET /api/auth/me` with session
- [ ] Catalog / webinars list (read)
- [ ] Registration or profile update (write)
- [ ] Admin role change (Cognito group sync)
- [ ] Worker: session reminder or email queue job processes
- [ ] Bill.com test connection (admin) if configured

---

## DR failover (platform, post-Aurora)

Replaces RDS `promote-read-replica` for platform.

1. Confirm regional outage or declare DR.
2. **Aurora:** Managed Global failover → writer in us-east-2 ([AWS docs](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database-disaster-recovery.html)).
3. Update DR ECS secrets if writer endpoint changes post-failover (verify in console).
4. Route CloudFront `/api*` to us-east-2 (`route_api_to_secondary = true` + apply us-east-1).
5. Scale DR ECS; scale down or isolate us-east-1 if needed.
6. Run platform smoke tests from DR.
7. **Failback:** Planned Global failover back to us-east-1 when primary region healthy; revert CloudFront.

Dev DR continues to use **RDS read replica + manual promote** (this runbook does not change dev).

---

## Rollback (during migration)

- Before cutover: drop empty Aurora; no user impact.
- After cutover, if critical failure: revert Secrets Manager to old RDS endpoint; redeploy ECS; restore from RDS snapshot if Aurora data bad.

Keep RDS snapshot until Aurora is validated for **at least 48 hours**.

---

## References

- [Aurora Global Database](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html)
- [Aurora pricing](https://aws.amazon.com/rds/aurora/pricing/)
- `docs/runbooks/multi-region-active-passive-us-east-2.md`: traffic DR (CloudFront, ECS)
- `infrastructure/terraform/environments/variables/platform.tfvars`: current RDS sizing

---

## Status log

| Date | Event |
|------|-------|
| 2026-06-20 | Aurora Global provisioned: `cht-platform-global`, primary `db.r6g.large` (us-east-1), secondary `db.r6g.large` (us-east-2) |
| 2026-06-20 | DMS decision: **AWS DMS**; replication task `cht-platform-rds-to-aurora` started (full load + CDC) |
| 2026-06-20 | App still on RDS (`aurora_use_for_app=false`); cutover pending CDC lag ≈ 0 |
| _TBD_ | Cutover complete |
| _TBD_ | Old RDS decommissioned |
