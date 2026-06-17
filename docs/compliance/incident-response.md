# Incident Response Plan

Operational runbook for security and availability incidents affecting the CHT Platform.

**Scope:** Platform (production) and staging in AWS account `233636046512`, region `us-east-1`.

**Last reviewed:** _Set date when approved_

---

## Roles

| Role | Responsibility | Contact |
|------|----------------|---------|
| **Incident commander** | Owns timeline, decisions, comms | _Name / email / phone_ |
| **Engineering lead** | Triage, containment, recovery | _Name / email_ |
| **AWS admin** | IAM, Secrets Manager, RDS, ECS | _Name / email_ |
| **GitHub admin** | Org/repo access, Actions, secrets | _Name / email_ |
| **Executive / legal** | Customer/regulator notification | _Name / email_ |

Document substitutes when primary contacts are unavailable.

---

## Severity levels

| Level | Examples | Response target | Notification |
|-------|----------|-----------------|--------------|
| **SEV-1** | Confirmed data breach, prod down, credential leak in git | Immediate (24/7) | Incident commander + executive |
| **SEV-2** | GuardDuty high/critical finding, sustained 5xx, payment DLQ growing | < 1 hour | Engineering lead + incident commander |
| **SEV-3** | Single alarm, non-prod issue, failed deploy | < 4 hours (business hours) | Engineering lead |
| **SEV-4** | Low-severity finding, planned maintenance follow-up | Next business day | Ticket / async |

---

## Detection sources

### Amazon GuardDuty

- **Scope:** One detector per account/region; managed by **platform** Terraform (`monitoring/guardduty`).
- **Routing:** EventBridge rule `cht-platform-guardduty-findings` → SNS topic `cht-platform-alerts`.
- **Action:** Open [GuardDuty console](https://console.aws.amazon.com/guardduty/) → Findings. Note severity, resource, and finding type.

### Amazon CloudWatch alarms

All alarms publish to SNS `cht-platform-alerts` (staging: `cht-platform-staging-alerts`). Subscribers are configured via `alarm_notification_emails` in Terraform tfvars — confirm subscription emails are active.

| Alarm (platform prefix) | Meaning |
|-------------------------|---------|
| `cht-platform-ecs-cpu-high` | ECS cluster CPU > 80% (2 periods) |
| `cht-platform-rds-cpu-high` | RDS CPU > 80% |
| `cht-platform-alb-5xx-errors` | ALB target 5xx count > 10 in 5 min |
| `cht-platform-application-errors` | Backend log ERROR count > 50 in 5 min |
| `cht-platform-email-dlq-messages` | Messages in email dead-letter queue |
| `cht-platform-payment-dlq-messages` | Messages in payment DLQ — **priority** |
| `cht-platform-cme-dlq-messages` | Messages in CME certificate DLQ |
| `cht-platform-scheduled-jobs-dlq-messages` | Scheduled job failures |

**Dashboard:** CloudWatch → Dashboards → `cht-platform-dashboard` (ECS, ALB, RDS, SQS).

### Other logs and audit trails

| Source | Location | Retention |
|--------|----------|-----------|
| **CloudTrail** | S3 `cht-platform-cloudtrail-*` + CloudWatch | 365 days (platform) |
| **VPC flow logs** | CloudWatch | 365 days |
| **ECS application logs** | `/ecs/cht-platform` | 365 days |
| **RDS PostgreSQL logs** | CloudWatch (`postgresql`, `upgrade`) | Per RDS export |
| **Admin API mutations** | Postgres `AdminAuditLog` table | Application retention |
| **AWS Config** | Config recorder `cht-platform-recorder` | Compliance drift |

### External signals

- GitHub Dependabot / security alerts
- Failed deploy workflows (`deploy-dev.yml`, `deploy-prod.yml`)
- User reports via support channels
- Vendor notifications (AWS, Zoom, Bill.com, etc.)

---

## Response workflow

```
Detect → Triage → Contain → Eradicate → Recover → Post-incident review
```

### 1. Detect and triage (first 15 minutes)

1. Acknowledge the alert (SNS email or manual report).
2. Assign **incident commander** and open a private incident channel/doc.
3. Record **start time**, **severity**, and **affected environment** (platform vs staging).
4. Check quick health:
   ```bash
   curl -sf https://testapp.communityhealth.media/health/ready
   curl -sf https://devapp.communityhealth.media/health/ready
   ./smoke.sh https://testapp.communityhealth.media
   ```
5. Gather evidence **before** making destructive changes:
   - GuardDuty finding details
   - CloudWatch alarm graph + recent ECS/RDS metrics
   - Relevant CloudTrail events (last 1–4 hours)
   - Recent GitHub Actions runs and merges
   - `AdminAuditLog` for suspicious admin activity (if applicable)

### 2. Escalation

| Condition | Escalate to |
|-----------|-------------|
| SEV-1 or suspected PII/payment data exposure | Incident commander + executive/legal immediately |
| GuardDuty severity ≥ 7 | Engineering lead + AWS admin |
| Payment DLQ alarm | Engineering lead (honorarium pipeline) |
| Cannot restore service within 30 minutes | Incident commander |
| Need to notify customers or partners | Executive/legal |

**Communication:** Internal updates every 30 minutes for SEV-1/SEV-2 until resolved. External comms only through executive/legal.

### 3. Contain

Choose actions based on incident type. Prefer **least destructive** steps that stop ongoing harm.

#### Suspected credential compromise

1. **Rotate affected secrets** in AWS Secrets Manager (via Terraform tfvars / GitHub Environment secrets, then redeploy).
2. **Revoke** exposed API keys at the vendor (Zoom, Bill.com, JotForm, Supabase/MediaHub).
3. **Invalidate sessions:** deploy backend if needed; users re-login after cookie rotation.
4. If GitHub token or PAT leaked: revoke in GitHub → Settings → Developer settings; audit org audit log.

#### Suspected unauthorized AWS access

1. **Disable** compromised IAM users or access keys (IAM → Users → Security credentials).
2. Review **CloudTrail** `ConsoleLogin`, `AssumeRole`, `GetSecretValue`, `RunTask` events.
3. Tighten **security groups** temporarily if unusual egress is observed (coordinate with engineering lead).
4. Enable or verify **GuardDuty** detector is active (platform stack).

#### Application attack or abuse (WAF / ALB)

1. Review ALB 5xx and WAF logs (CloudFront/WAF console).
2. Block offending IPs in **WAF** (CloudFront scope) if confirmed malicious.
3. Scale ECS tasks if resource exhaustion (CPU alarm) — note root cause before leaving scaled up.

#### Data integrity / bad deploy

1. **Stop bleeding:** rollback ECS (see [disaster-recovery.md](./disaster-recovery.md#ecs-rollback)).
2. Do **not** run forward migrations until cause is understood.
3. Preserve logs and task definition revisions for postmortem.

### 4. Eradicate and recover

- Patch vulnerability or remove malicious access.
- Redeploy known-good image tag via GitHub Actions **Rollback Deployment** or re-run last green deploy.
- Replay or drain DLQ messages after fixing root cause (payment DLQ requires manual review per message).
- Verify health endpoints and critical user flows (login, survey webhook, admin).

### 5. Post-incident review (within 5 business days)

Document in a shared template:

- Timeline (detect → resolve)
- Root cause
- Impact (users, data, duration)
- What worked / what didn’t
- Action items with owners and due dates

Store postmortems where your org keeps audit evidence (not necessarily in this repo).

---

## AWS lockdown checklist

Use when credentials are exposed or unauthorized AWS activity is confirmed.

- [ ] Identify affected IAM principals in CloudTrail
- [ ] Deactivate access keys for compromised users
- [ ] Rotate Secrets Manager secrets used by ECS (`cht-platform-*` secrets)
- [ ] Review and revoke unexpected ECS task executions
- [ ] Confirm RDS is not publicly accessible (should be `false`)
- [ ] Confirm S3 buckets block public access (Config rules / console)
- [ ] Snapshot RDS before major recovery steps if data integrity is in question
- [ ] Preserve CloudTrail and GuardDuty findings (do not delete logs)

**Emergency contacts:** AWS Support (Business/Enterprise support plan if available).

---

## GitHub lockdown checklist

Use when repo secrets, PATs, or org access may be compromised.

- [ ] Audit **Organization audit log** and **Security log**
- [ ] Revoke suspicious PATs, SSH keys, and OAuth apps
- [ ] Review members with **admin** on `OasisBureua/cht-platform-tool`
- [ ] Rotate **GitHub Environment secrets** (`dev`, `platform`/`production`)
- [ ] Confirm **branch protection** and required reviews on `main` / `release/**`
- [ ] Disable or pause **Actions** temporarily only if runner compromise is suspected
- [ ] Verify `AWS_ROLE_ARN` OIDC role trust policy matches expected repos/environments
- [ ] Re-run `./scripts/verify-github-env-secrets.sh` after rotation

**Deploy role:** `GitHubActions-CHT-Platform` with scoped policy `GitHubActions-CHT-Platform-Deploy` (see `infrastructure/iam/github-actions-deploy-policy.json`).

---

## Notification and legal

- **Customer notification:** Coordinate with executive/legal if personal data or payment data may have been accessed.
- **Regulatory:** Determine breach notification obligations based on data types involved (PII, tax/W-9 data) and jurisdiction.
- **Vendors:** Notify affected subprocessors if their credentials were involved.

---

## Related documents

- [disaster-recovery.md](./disaster-recovery.md) — RDS restore, ECS redeploy
- [../engineering/deployment.md](../engineering/deployment.md) — Normal deploy and rollback via Actions
- [../engineering/architecture.md](../engineering/architecture.md) — System components and data flows
- [../../infrastructure/README.md](../../infrastructure/README.md) — Terraform security controls
