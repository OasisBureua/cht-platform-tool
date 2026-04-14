# Testing Checklist - CHT Platform

## Pre-Deployment Tests

### Local Development

- [ ] Backend builds successfully: `cd backend && npm run build`
- [ ] Worker builds successfully: `cd worker && npm run build`
- [ ] Frontend builds successfully: `cd frontend && npm run build`
- [ ] All health endpoints work: `./scripts/test-health.sh`
- [ ] Docker images build: `./scripts/build-images.sh v1.0.0`
- [ ] Unit tests pass (if any)

### AWS Prerequisites

- [ ] AWS credentials configured: `aws sts get-caller-identity`
- [ ] ECR repositories exist: `aws ecr describe-repositories --region us-east-1`
- [ ] Docker images pushed: `./scripts/push-images.sh v1.0.0 us-east-1`
- [ ] SSL certificates requested
- [ ] SSL certificates validated and issued

---

## Post-Deployment Tests (Dev)

### Infrastructure Verification

```bash
cd infrastructure/terraform/environments/us-east-1
terraform output
```

- [ ] VPC created with correct CIDR
- [ ] ALB DNS name accessible
- [ ] CloudFront DNS name accessible
- [ ] RDS endpoint available (private)
- [ ] Redis endpoint available (private)
- [ ] Route53 zone created
- [ ] Route53 nameservers returned

### DNS Configuration

```bash
# Check Route53 nameservers
cd infrastructure/terraform/environments/us-east-1
terraform output route53_nameservers
```

- [ ] NS records added to main DNS provider
- [ ] DNS propagation verified: `dig api.communityhealth.media`
- [ ] DNS propagation verified: `dig testapp.communityhealth.media`
- [ ] Both records resolve to correct values

### Backend Health Checks

```bash
# Via ALB (direct)
ALB_DNS=$(cd infrastructure/terraform/environments/us-east-1 && terraform output -raw alb_dns_name)
curl http://$ALB_DNS/health

# Via domain (after DNS)
curl https://api.communityhealth.media/health
curl https://api.communityhealth.media/health/ready
curl https://api.communityhealth.media/health/live
curl https://api.communityhealth.media/health/detail
```

- [ ] `/health` returns 200 OK
- [ ] `/health/ready` returns `{"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}}`
- [ ] `/health/live` returns uptime
- [ ] `/health/detail` returns application info
- [ ] No SSL certificate errors
- [ ] Response time < 500ms

### Frontend Tests

```bash
open https://testapp.communityhealth.media
```

- [ ] React app loads without errors
- [ ] No console errors in browser
- [ ] Auth0 login screen appears
- [ ] CSS/styling loads correctly
- [ ] No 404 errors for assets
- [ ] SSL certificate valid
- [ ] CloudFront serving correctly

### Application Flow Tests

```bash
# Create test user in Auth0
# Login and test full flow
```

- [ ] Can create new user account
- [ ] Can login with email/password
- [ ] Can login with Google (if enabled)
- [ ] Redirects to dashboard after login
- [ ] Dashboard loads with user data
- [ ] Can navigate to Programs page
- [ ] Can view program details
- [ ] Can enroll in a program (if test data available)
- [ ] Can logout successfully

### Database Tests

```bash
# Connect to ECS task and run queries
./scripts/run-migrations.sh dev
```

- [ ] Migrations run successfully
- [ ] All tables created
- [ ] Can query users table
- [ ] Indexes created
- [ ] Foreign keys working

### Worker Service Tests

```bash
# Check worker logs
aws logs tail /ecs/cht-platform-dev --follow --region us-east-1 | grep worker
```

- [ ] Worker service running
- [ ] Successfully connects to SQS
- [ ] Successfully connects to database
- [ ] No error logs
- [ ] Processes test message (if sent)

### Performance Tests

```bash
# Load test backend
./scripts/load-test.sh https://api.communityhealth.media 100 30
```

- [ ] Handles 100 concurrent users
- [ ] Average response time < 200ms
- [ ] No 5xx errors
- [ ] ECS auto-scaling triggers (if load high enough)
- [ ] CloudWatch metrics updating

### Security Tests

- [ ] All S3 buckets are private (no public access)
- [ ] Database only accessible from private subnet
- [ ] Redis only accessible from private subnet
- [ ] ALB requires HTTPS
- [ ] CloudFront requires HTTPS
- [ ] Security groups properly configured
- [ ] IAM roles follow least privilege

### Monitoring Tests

```bash
# Check CloudWatch
open https://console.aws.amazon.com/cloudwatch
```

- [ ] CloudWatch dashboard exists
- [ ] ECS metrics appearing
- [ ] ALB metrics appearing
- [ ] RDS metrics appearing
- [ ] ElastiCache metrics appearing
- [ ] Log groups created
- [ ] Logs streaming correctly
- [ ] Health check alarm configured

### Cost Verification

```bash
# Check current spend
aws ce get-cost-and-usage \
  --time-period Start=2025-12-01,End=2025-12-22 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --filter file://cost-filter.json
```

- [ ] Current costs within expected range (~$145/month dev)
- [ ] Cost alerts configured
- [ ] No unexpected resource charges
- [ ] NAT Gateway costs reasonable

---

## Production Deployment Tests

### Pre-Production

- [ ] All dev tests passed
- [ ] Production variables reviewed: `cat environments/variables/prod.tfvars`
- [ ] Application secrets configured
- [ ] SNS topic for alerts created
- [ ] Backup strategy documented
- [ ] Disaster recovery plan reviewed

### Production Infrastructure

```bash
./scripts/deploy-primary.sh prod
```

- [ ] RDS Multi-AZ enabled
- [ ] Larger instance sizes deployed
- [ ] More tasks running (3 backend, 2 worker)
- [ ] 30-day backup retention
- [ ] Enhanced monitoring enabled

### Production Application Tests

- [ ] SSL certificate valid (production domain)
- [ ] All health checks passing
- [ ] Login with production Auth0
- [ ] Stripe production keys working
- [ ] SES emails sending
- [ ] All integrations working

### Production Performance

- [ ] Load test with 500 concurrent users
- [ ] Auto-scaling working correctly
- [ ] Response times acceptable
- [ ] No bottlenecks

---

## Disaster Recovery Tests

### Manual Failover Drill

```bash
# Quarterly test
cd infrastructure/terraform/environments/us-east-2-standby
```

- [ ] us-east-2 infrastructure deploys successfully
- [ ] Database restores from snapshot
- [ ] Services come online in us-east-2
- [ ] DNS can be updated manually
- [ ] Application works in us-east-2
- [ ] Time to recovery documented

### Backup Verification

```bash
# Check RDS snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier cht-platform-prod-db \
  --region us-east-1
```

- [ ] Automated snapshots exist
- [ ] Snapshots are recent (< 24 hours)
- [ ] Manual snapshots work
- [ ] Can restore from snapshot

---

## Regression Tests (After Updates)

### After Infrastructure Changes

- [ ] All original tests still pass
- [ ] No unexpected cost increases
- [ ] No downtime during update
- [ ] Rollback plan tested

### After Application Updates

- [ ] Health checks still pass
- [ ] Login still works
- [ ] All features still functional
- [ ] Performance unchanged or better
- [ ] No new errors in logs

---

## Continuous Monitoring

### Daily Checks

- [ ] Check CloudWatch dashboard
- [ ] Review error logs
- [ ] Check cost explorer
- [ ] Verify backups ran

### Weekly Checks

- [ ] Review performance metrics
- [ ] Check auto-scaling events
- [ ] Review security group rules
- [ ] Update documentation if needed

### Monthly Checks

- [ ] Load testing
- [ ] Disaster recovery drill
- [ ] Cost optimization review
- [ ] Security audit

---

## Emergency Response Tests

### Service Degradation

- [ ] CloudWatch alarms fire correctly
- [ ] SNS notifications received
- [ ] Runbook procedures work
- [ ] Can diagnose issues quickly

### Complete Outage

- [ ] Can access logs
- [ ] Can access AWS Console
- [ ] Can deploy us-east-2
- [ ] Can contact team members

---

## Sign-Off

**Dev Environment:**

- [ ] All tests passed
- [ ] Tested by: ________________
- [ ] Date: ________________
- [ ] Approved for production: Yes/No

**Production Environment:**

- [ ] All tests passed
- [ ] Load tested
- [ ] Security reviewed
- [ ] Tested by: ________________
- [ ] Date: ________________
- [ ] Production approved: Yes/No

---

## Notes

Document any issues found during testing:

1. TBD
2. TBD
3. TBD
