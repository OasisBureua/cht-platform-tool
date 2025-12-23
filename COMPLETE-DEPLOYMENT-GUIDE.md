# Complete Deployment Guide - CHT Platform

## Overview

This guide covers the complete deployment of the CHT Platform from scratch.

**Estimated Time:** 4-5 hours
**Cost:** ~$145/month (dev) or ~$268/month (prod)

---

## Prerequisites

### Local Environment
```bash
# Check prerequisites
node --version    # Should be v18+
npm --version
docker --version
terraform --version  # Should be v1.0+
aws --version
```

### AWS Setup
- AWS account with admin access
- AWS CLI configured
- ECR repositories created

### Code Ready
- All code committed to Git
- Docker images built and tested locally
- Health checks working locally

---

## Phase 1: SSL Certificates (60 minutes)

### Step 1: Request Certificate
```bash
./scripts/request-certificates-communityhealth.sh
```

### Step 2: Add DNS Validation
Contact DNS administrator with validation CNAME record.

### Step 3: Wait for Validation
```bash
# Check every 5-10 minutes
watch -n 300 './scripts/check-certificate-status.sh'
```

### Step 4: Update Variables
```bash
# Edit environments/variables/dev.tfvars or prod.tfvars
nano infrastructure/terraform/environments/variables/dev.tfvars

# Add certificate ARN
acm_certificate_arn        = "arn:aws:acm:us-east-1:..."
cloudfront_certificate_arn = "arn:aws:acm:us-east-1:..."
```

---

## Phase 2: Terraform Backend (15 minutes)

### Step 1: Create S3 Bucket
```bash
aws s3 mb s3://cht-platform-terraform-state --region us-east-1

aws s3api put-bucket-versioning \
  --bucket cht-platform-terraform-state \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket cht-platform-terraform-state \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
```

### Step 2: Create DynamoDB Table
```bash
aws dynamodb create-table \
  --table-name cht-platform-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

---

## Phase 3: Build and Push Docker Images (30 minutes)

### Step 1: Build Images
```bash
./scripts/build-images.sh v1.0.0
```

### Step 2: Test Images Locally
```bash
docker-compose -f docker-compose.test.yml up
# Test health endpoints
curl http://localhost:3000/health
```

### Step 3: Push to ECR
```bash
./scripts/push-images.sh v1.0.0 us-east-1
```

### Step 4: Update Variables
```bash
# Edit dev.tfvars or prod.tfvars
nano infrastructure/terraform/environments/variables/dev.tfvars

# Update image URLs
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:v1.0.0"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:v1.0.0"
```

---

## Phase 4: Deploy Infrastructure (45 minutes)

### Step 1: Deploy to Dev
```bash
./scripts/deploy-primary.sh dev
```

**This will:**
1. Initialize Terraform
2. Create plan
3. Ask for confirmation
4. Deploy (takes ~30-40 minutes):
   - VPC with subnets
   - NAT Gateways
   - RDS PostgreSQL
   - ElastiCache Redis
   - ECS Cluster
   - ALB
   - CloudFront
   - Route53
   - All supporting infrastructure

### Step 2: Save Outputs
```bash
cd infrastructure/terraform/environments/us-east-1
terraform output > ~/cht-deployment-outputs.txt
```

---

## Phase 5: DNS Configuration (30 minutes)

### Step 1: Get Route53 Nameservers
```bash
cd infrastructure/terraform/environments/us-east-1
terraform output route53_nameservers
```

### Step 2: Add NS Records
At your DNS provider (where communityhealth.media is registered):
```
Type: NS
Name: api
Value: [nameservers from above]

Type: NS
Name: app
Value: [nameservers from above]
```

### Step 3: Wait for DNS Propagation
```bash
# Test DNS (may take 5-30 minutes)
watch -n 60 'dig api.communityhealth.media && dig app.communityhealth.media'
```

---

## Phase 6: Application Deployment (30 minutes)

### Step 1: Run Database Migrations
```bash
./scripts/run-migrations.sh dev
```

### Step 2: Deploy Frontend
```bash
./scripts/deploy-frontend.sh dev
```

### Step 3: Seed Initial Data (Optional)
```bash
# If you have seed script
cd backend
npm run seed
```

---

## Phase 7: Testing (30 minutes)

### Step 1: Test Backend
```bash
curl https://api.communityhealth.media/health
curl https://api.communityhealth.media/health/ready
```

**Expected:**
```json
{
  "status": "ok",
  "info": {
    "database": {"status": "up"},
    "redis": {"status": "up"}
  }
}
```

### Step 2: Test Frontend
```bash
open https://app.communityhealth.media
```

**Expected:**
- React app loads
- Auth0 login screen appears
- No console errors

### Step 3: Test Full Flow
1. Create test user
2. Login
3. View dashboard
4. Test key features

### Step 4: Monitor Logs
```bash
aws logs tail /ecs/cht-platform-dev --follow --region us-east-1
```

Look for:
- No error logs
- Health check requests
- API requests

---

## Phase 8: Post-Deployment (30 minutes)

### Step 1: Add Login Button to Main Site
Provide to website team:
```html
<a href="https://app.communityhealth.media" class="btn btn-primary">
  Healthcare Professional Login →
</a>
```

### Step 2: Set Up Monitoring Alerts
```bash
# Create SNS topic for alerts
aws sns create-topic --name cht-platform-alerts

# Subscribe your email
aws sns subscribe \
  --topic-arn arn:aws:sns:us-east-1:233636046512:cht-platform-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

### Step 3: Document Everything
- Save all terraform outputs
- Document DNS changes
- Note any issues encountered
- Update team wiki

---

## Production Deployment

### Differences from Dev
```bash
# Use prod.tfvars instead of dev.tfvars
./scripts/deploy-primary.sh prod
```

**Key Differences:**
- Larger instance sizes
- Multi-AZ RDS
- More tasks running
- 30-day backup retention
- Enhanced monitoring
- **Cost: ~$268/month**

---

## Troubleshooting

### Issue: Certificate Not Validating
**Solution:** Check DNS records added correctly, wait 30 minutes

### Issue: Terraform Apply Fails
**Solution:** Check AWS credentials, review error message, check permissions

### Issue: ECS Tasks Not Starting
**Solution:** Check CloudWatch logs, verify security groups, check ECR access

### Issue: DNS Not Resolving
**Solution:** Verify NS records added, wait for propagation, check with `dig`

### Issue: Health Check Failing
**Solution:** Check RDS connection, verify Redis connection, review logs

### Issue: Frontend 403 Errors
**Solution:** Check S3 bucket policy, verify CloudFront OAI, check CORS

---

## Rollback Procedure

If something goes wrong:
```bash
# Destroy infrastructure
cd infrastructure/terraform/environments/us-east-1
terraform destroy -var-file="../variables/dev.tfvars"

# Fix issues
# Review errors
# Test locally

# Redeploy
./scripts/deploy-primary.sh dev
```

---

## Cost Management

### Dev Environment
- **Monthly:** ~$145
- **Breakdown:**
  - NAT Gateway: $65
  - ECS: $22
  - RDS: $15
  - ElastiCache: $12
  - ALB: $20
  - Other: $11

### Production Environment
- **Monthly:** ~$268
- **Breakdown:**
  - NAT Gateway: $65
  - ECS: $44
  - RDS: $30
  - ElastiCache: $24
  - ALB: $20
  - Other: $85

### Cost Optimization
- Use t3/t4g instances
- Enable auto-scaling
- Set up cost alerts
- Review monthly usage
- Consider reserved instances for production

---

## Success Criteria

✅ All checks passed:
- [ ] Backend health returns 200 OK
- [ ] Database connected
- [ ] Redis connected
- [ ] Frontend loads
- [ ] Can login
- [ ] Dashboard displays
- [ ] No critical errors in logs
- [ ] DNS resolving correctly
- [ ] SSL certificates valid

---

## Next Steps

After successful deployment:
1. Monitor for 24 hours
2. Load test
3. Train team
4. Update documentation
5. Plan disaster recovery drill

---

## Support

- **Terraform Issues:** Check state file, review logs
- **AWS Issues:** Check AWS Health Dashboard
- **Application Issues:** Check CloudWatch logs
- **DNS Issues:** Check Route53 console

