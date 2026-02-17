# us-east-2 Standby Infrastructure

## Status: NOT DEPLOYED (Manual Failover)

This directory contains the complete infrastructure code for us-east-2, but it is **NOT deployed by default** to save costs (~$268/month).

## When to Deploy

Deploy this infrastructure when:
- us-east-1 has a **regional outage**
- us-east-1 is experiencing **extended downtime** (>30 minutes)
- You need to perform **maintenance** on us-east-1

## How to Deploy (During Disaster)
```bash
cd ~/Documents/cht-platform-tool/infrastructure/terraform/environments/us-east-2-standby

# 1. Initialize
terraform init

# 2. Plan
terraform plan -out=disaster-recovery.tfplan

# 3. Deploy (takes ~25-30 minutes)
terraform apply disaster-recovery.tfplan

# 4. Update DNS (manual)
# Update Route53 records in us-east-1 to point to us-east-2 resources

# 5. Test
curl https://testapp.communityhealth.media/health/ready
```

## Cost

- **NOT deployed:** $0/month
- **When deployed:** ~$268/month
- **Activation time:** ~25-30 minutes

## Manual Failover Steps

See: `../../DISASTER-RECOVERY-MANUAL-FAILOVER.md` for complete procedure.