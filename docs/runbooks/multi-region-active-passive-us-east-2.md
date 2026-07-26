# Runbook: Multi-region active-passive (us-east-1 -> us-east-2)

Set up active-passive disaster recovery for CHT with primary in `us-east-1` and standby in `us-east-2`.

**Topology:** Active-passive  
**Failover mode:** Automatic for `/health*` only (CloudFront origin group). `/api*` stays on primary ALB — AWS origin groups do not support POST/PUT/PATCH/DELETE. Full API DR requires manual origin swap or Route53 failover (see runbook).  
**RTO/RPO target:** 60 min / 15 min  
**Standby capacity:** 50% of primary  
**Queue strategy:** Regional queues + replay/rebuild during failover

---

## What is implemented now

- CloudFront module supports optional **health-check** origin failover (origin group on `/health*` only):
  - primary API origin (`us-east-1` ALB)
  - secondary API origin (`us-east-2` ALB)
  - origin-group failover on 5xx for GET/HEAD/OPTIONS paths only
  - `/api*` remains on primary ALB (CloudFront origin groups cannot proxy mutating HTTP methods)
- `us-east-1` environment accepts `secondary_api_origin_domain`
- `platform.tfvars` and `dev.tfvars` include `secondary_api_origin_domain` placeholder
- **ECR replication** `us-east-1` → `us-east-2` for `cht-platform-*` repos (platform apply)
- **GuardDuty** in both regions (`us-east-1` platform stack, `us-east-2` DR stack) → regional SNS alerts

This allows `/api*` and `/health*` traffic to fail over automatically once the `us-east-2` ALB exists and the domain is configured.

---

## Remaining implementation checklist (infra-wide)

### 1) Create `environments/us-east-2/` stack

- Mirror core modules from `us-east-1`:
  - VPC, ECS cluster/services, ALB, S3 buckets, IAM, KMS, secrets, SQS, EventBridge, monitoring
- Set standby ECS desired count to ~50% of primary for backend/worker
- Keep global edge singletons out of secondary stack:
  - CloudFront/WAF (global edge)
  - Route53 hosted zone records (single control plane)
- Regional compliance in DR stack:
  - GuardDuty detector + EventBridge → SNS (us-east-2)
  - ECR images replicated from us-east-1 (configured on platform apply)

### 2) Data replication

- RDS:
  - Create cross-region read replica in `us-east-2`
  - Run failover/promotion playbook
- S3:
  - Keep CI deploy to both regional frontend buckets
  - Optional CRR for frontend/session-assets via module replication variables
- Secrets:
  - Replicate operational secrets to `us-east-2` Secrets Manager via `replica_regions`
  - Verify ECS tasks in secondary can resolve all expected keys
- Cognito:
  - Native multi-Region replication is available (June 2026 launch).
  - Configure a replica pool in `us-east-2` for the primary pool in `us-east-1`.
  - Current Terraform module does not yet automate replica creation; use AWS CLI/SDK/Console workflow until provider-native support is added to this repo.

### Cognito MRR operational steps (CLI, until provider supports replica configuration)

1. Ensure pool tier is `ESSENTIALS` or `PLUS` in Terraform (`cognito_user_pool_tier`).
2. Ensure required KMS setup for Cognito MRR per AWS docs.
3. Create replica from primary pool (replace placeholders):

```bash
aws cognito-idp create-user-pool-replica \
  --region us-east-1 \
  --user-pool-id <PRIMARY_POOL_ID> \
  --region-name us-east-2
```

4. Verify replica status:

```bash
aws cognito-idp describe-user-pool \
  --region us-east-1 \
  --user-pool-id <PRIMARY_POOL_ID>
```

5. During regional auth failover, switch app auth config to secondary issuer/domain and validate sign-in/token flows.

### 3) Traffic failover

- Populate `secondary_api_origin_domain` in tfvars with secondary ALB DNS
- Apply `us-east-1` CloudFront update
- Validate failover by simulating primary API 5xx during maintenance

### 4) Queue replay/rebuild

- Keep SQS/EventBridge regional
- Maintain replay runbook for failover:
  - identify in-flight queue backlog in primary
  - replay/seed critical events into secondary queues
  - validate idempotency in workers

### 5) DR testing cadence

- Quarterly DR drill:
  - fail API to secondary
  - verify auth, payments, webinars, catalogs, admin workflows
  - execute rollback to primary

---

## Apply order

Each environment uses its **own Terraform state** (see `infrastructure/terraform/environments/backends/README.md`):

| Environment | Primary state key | DR state key |
| ------------- | ----------------- | ------------ |
| platform      | `us-east-1/terraform.tfstate` | `us-east-2/terraform.tfstate` |
| dev           | `us-east-1-dev/terraform.tfstate` | `us-east-2-dev/terraform.tfstate` |

1. Deploy `us-east-1` stack for your environment (enables ECR replication to us-east-2 on first **platform** apply)
2. Deploy `us-east-2` stack (standby infra + GuardDuty)
3. Stand up replicated data (RDS replica + secrets replication)
4. Set `secondary_api_origin_domain` in `platform.tfvars` or `dev.tfvars`
5. Apply `us-east-1` to enable CloudFront API failover
6. Deploy frontend to both S3 buckets: `./scripts/deploy-frontend.sh <env> both`
7. Run controlled failover test and record results

---

## DR failover test checklist (CloudFront origin failover)

1. Confirm `secondary_api_origin_domain` is set and applied in `us-east-1`.
2. Verify normal state:
   - `curl https://testapp.communityhealth.media/health`
   - admin login works
   - `/api/docs` accessible for admin
3. Simulate primary API failure:
   - scale primary backend service to `0` or block ALB target group
4. Re-test API via CloudFront:
   - `curl https://testapp.communityhealth.media/health`
   - ensure response recovers via secondary ALB
5. Validate core workflows in failover:
   - auth session validation
   - catalog read
   - registration writes
   - background worker queue processing
6. Promote DR replica only if full regional failover is declared.
7. Roll back:
   - restore primary backend service
   - verify CloudFront traffic returns to primary origin
8. Capture metrics:
   - failover start/end timestamps
   - error rate and p95 API latency
   - any manual interventions performed
