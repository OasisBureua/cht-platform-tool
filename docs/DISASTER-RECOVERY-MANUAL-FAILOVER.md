# Manual Failover to us-east-2 - Complete Guide

## Scenario: us-east-1 Complete Outage

**RTO:** 30-40 minutes
**RPO:** Last automated backup (max 24 hours)
**Cost:** Adds ~$268/month while running

---

## Pre-Disaster Preparation (Do Once)

### 1. Verify Backup Configuration
```bash
# Check RDS snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier cht-platform-prod-db \
  --region us-east-1

# Verify automated backups enabled
aws rds describe-db-instances \
  --db-instance-identifier cht-platform-prod-db \
  --region us-east-1 \
  --query 'DBInstances[0].BackupRetentionPeriod'
```

### 2. Document Current Configuration

Save these values:
- Route53 Zone ID
- Current DNS records
- RDS snapshot schedule
- ECR image tags

---

## Disaster Recovery Procedure

### Step 1: Assess Situation (5 minutes)
```bash
# Check CloudWatch alarms
aws cloudwatch describe-alarms \
  --alarm-names "cht-platform-prod-primary-region-down" \
  --region us-east-1

# Check Route53 health check
aws route53 get-health-check-status \
  --health-check-id [ID] \
  --region us-east-1

# Decision: If us-east-1 down for >15 minutes, proceed with failover
```

### Step 2: Find Latest RDS Snapshot (5 minutes)
```bash
# Get latest automated snapshot
LATEST_SNAPSHOT=$(aws rds describe-db-snapshots \
  --db-instance-identifier cht-platform-prod-db \
  --region us-east-1 \
  --query 'DBSnapshots | sort_by(@, &SnapshotCreateTime) | [-1].DBSnapshotIdentifier' \
  --output text)

echo "Latest snapshot: $LATEST_SNAPSHOT"

# Verify snapshot age
aws rds describe-db-snapshots \
  --db-snapshot-identifier $LATEST_SNAPSHOT \
  --region us-east-1 \
  --query 'DBSnapshots[0].SnapshotCreateTime'
```

### Step 3: Copy Snapshot to us-east-2 (10 minutes)
```bash
# Copy snapshot to us-east-2
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier arn:aws:rds:us-east-1:233636046512:snapshot:$LATEST_SNAPSHOT \
  --target-db-snapshot-identifier cht-platform-dr-$(date +%Y%m%d-%H%M) \
  --region us-east-2

# Wait for copy to complete
aws rds wait db-snapshot-available \
  --db-snapshot-identifier cht-platform-dr-$(date +%Y%m%d-%H%M) \
  --region us-east-2
```

### Step 4: Deploy us-east-2 Infrastructure (25 minutes)
```bash
cd infrastructure/terraform/environments/us-east-2

# Update terraform.tfvars with snapshot
cat >> terraform.tfvars << TF
restore_from_snapshot = "cht-platform-dr-$(date +%Y%m%d-%H%M)"
TF

# Deploy
terraform init
terraform apply -auto-approve
```

### Step 5: Update Route53 DNS (5 minutes)
```bash
# Get us-east-2 outputs
cd infrastructure/terraform/environments/us-east-2-standby
US_EAST_2_ALB=$(terraform output -raw alb_dns_name)
US_EAST_2_CF=$(terraform output -raw cloudfront_domain_name)

# Update DNS records (manual via AWS Console or CLI)
# Point api.communityhealth.media → $US_EAST_2_ALB
# Point app.communityhealth.media → $US_EAST_2_CF
```

### Step 6: Verify Services (10 minutes)
```bash
# Test backend health
curl https://api.communityhealth.media/health/ready

# Test frontend
open https://app.communityhealth.media

# Monitor logs
aws logs tail /ecs/cht-platform-prod-failover --follow --region us-east-2
```

### Step 7: Notify Team

Send notification with:
- Time of failover
- Estimated data loss (RPO)
- Current status
- Expected recovery time

---

## Return to Primary (After us-east-1 Recovered)

### 1. Verify us-east-1 is Healthy
```bash
# Check AWS status
open https://status.aws.amazon.com

# Verify services
aws ecs describe-clusters \
  --clusters cht-platform-prod-cluster \
  --region us-east-1
```

### 2. Create Snapshot of us-east-2
```bash
# Capture current data
aws rds create-db-snapshot \
  --db-instance-identifier cht-platform-prod-failover-db \
  --db-snapshot-identifier cht-platform-return-primary-$(date +%Y%m%d) \
  --region us-east-2
```

### 3. Restore us-east-1 from us-east-2 Snapshot
```bash
# Copy snapshot to us-east-1
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier arn:aws:rds:us-east-2:...:snapshot:cht-platform-return-primary-$(date +%Y%m%d) \
  --target-db-snapshot-identifier cht-platform-restored-$(date +%Y%m%d) \
  --region us-east-1

# Restore database
# (Update terraform.tfvars in us-east-1 with new snapshot)
cd infrastructure/terraform/environments/us-east-1
terraform apply
```

### 4. Switch DNS Back to us-east-1
```bash
# Update Route53 records
# Point back to us-east-1 ALB and CloudFront
```

### 5. Destroy us-east-2 (Save Cost)
```bash
cd infrastructure/terraform/environments/us-east-2-standby
terraform destroy
```

---

## Cost During Disaster

- **Normal (us-east-1 only):** $273/month
- **During DR (both regions):** $541/month
- **Duration:** Until us-east-1 recovered

---

## Testing Failover

**Quarterly DR Drill:**
1. Create test snapshot
2. Deploy to us-east-2 (separate test environment)
3. Time the procedure
4. Document lessons learned
5. Destroy test environment

---

## Automation (Future Enhancement)

This procedure can be automated with:
- AWS Lambda for snapshot copying
- Step Functions for orchestration
- EventBridge for triggering

Estimated effort: 1-2 days development
Cost savings: ~30 minutes faster RTO

