# CHT Platform Deployment Guide

## Prerequisites

- AWS Account with admin access
- AWS CLI configured
- Docker installed
- Terraform >= 1.0
- Node.js 18+ (for local development)
- Python 3.11+ (for local development)

## Step-by-Step Deployment

### 1. Setup ECR Repositories
```bash
# Create ECR repositories
./scripts/setup-ecr.sh us-east-1

# Output will show your repository URLs
```

### 2. Build Docker Images
```bash
# Build both images
./scripts/build-images.sh v1.0.0

# Or use latest tag
./scripts/build-images.sh
```

### 3. Test Images Locally
```bash
# Test with Docker Compose
docker-compose -f docker-compose.production.yml up

# Access:
# - Backend: http://localhost:3000
# - Frontend: http://localhost:5173
```

### 4. Push Images to ECR
```bash
# Push to ECR
./scripts/push-images.sh v1.0.0 us-east-1

# Note the ECR URLs for terraform.tfvars
```

### 5. Setup Terraform State Backend
```bash
# Create S3 bucket for Terraform state
aws s3 mb s3://cht-platform-terraform-state-dev --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket cht-platform-terraform-state-dev \
  --versioning-configuration Status=Enabled

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket cht-platform-terraform-state-dev \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name cht-platform-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 6. Configure Terraform Variables
```bash
cd infrastructure/terraform/environments/dev

# Copy example
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required variables:**
```hcl
# Update these with your ECR URLs from step 4
backend_image = "123456789012.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:v1.0.0"
worker_image  = "123456789012.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:v1.0.0"
```

**Optional but recommended:**
```hcl
# SSL Certificate (create in AWS Certificate Manager first)
acm_certificate_arn = "arn:aws:acm:us-east-1:123456789012:certificate/..."

# Domain
domain_aliases = ["app.example.com"]

# Secrets (or use environment variables)
stripe_secret_key = "sk_test_..."
hubspot_smtp_user       = "..."  # From HubSpot transactional email token
hubspot_smtp_password   = "..."  # From HubSpot transactional email token
```

### 7. Deploy Infrastructure
```bash
# Initialize Terraform
./scripts/deploy.sh dev init

# Review plan
./scripts/deploy.sh dev plan

# Apply (this will take ~15-20 minutes)
./scripts/deploy.sh dev apply
```

### 8. Get Outputs
```bash
cd infrastructure/terraform/environments/dev

# Get all outputs
terraform output

# Get specific output
terraform output alb_dns_name
terraform output cloudfront_domain_name
```

### 9. Run Database Migrations
```bash
# Get ECS cluster name
CLUSTER=$(terraform output -raw cluster_name)

# Get backend task ARN
TASK_ARN=$(aws ecs list-tasks --cluster $CLUSTER --family cht-platform-dev-backend --query 'taskArns[0]' --output text)

# Run migrations
aws ecs execute-command \
  --cluster $CLUSTER \
  --task $TASK_ARN \
  --container backend \
  --interactive \
  --command "npx prisma migrate deploy"
```

### 10. Verify Deployment
```bash
# Get ALB DNS
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test health endpoint
curl https://$ALB_DNS/health

# Should return:
# {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}}
```

### 11. Deploy Frontend
```bash
# Build frontend
cd frontend
npm run build

# Get S3 bucket name
BUCKET=$(cd ../infrastructure/terraform/environments/dev && terraform output -raw frontend_bucket)

# Upload to S3
aws s3 sync dist/ s3://$BUCKET/ --delete

# Get CloudFront distribution
DIST_ID=$(cd ../infrastructure/terraform/environments/dev && terraform output -raw cloudfront_distribution_id)

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"
```

### 12. Access Your Application
```bash
# Get CloudFront URL
terraform output cloudfront_domain_name

# Or use your custom domain (if configured)
# https://app.example.com
```

## CI/CD Setup (GitHub Actions)

### 1. Add GitHub Secrets

Go to GitHub Repository → Settings → Secrets and add:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### 2. Push to GitHub
```bash
git add .
git commit -m "feat: complete infrastructure and deployment"
git push origin develop
```

GitHub Actions will automatically:
1. Run tests
2. Build Docker images
3. Push to ECR
4. Deploy to dev environment

### 3. Deploy to Production
```bash
# Create prod environment
cp -r infrastructure/terraform/environments/dev infrastructure/terraform/environments/prod

# Update prod/main.tf
# - Change environment = "prod"
# - Enable Multi-AZ
# - Increase task counts

# Merge to main
git checkout main
git merge develop
git push origin main
```

## Monitoring

### CloudWatch Dashboard
```bash
# Get dashboard URL
echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=cht-platform-dev-dashboard"
```

### View Logs
```bash
# Backend logs
aws logs tail /ecs/cht-platform-dev --follow --filter-pattern "ERROR"

# Worker logs
aws logs tail /ecs/cht-platform-dev --follow --filter-pattern "worker"
```

### Alarms

All critical metrics have CloudWatch alarms configured. To receive notifications:

1. Create SNS topic
2. Subscribe your email
3. Update `sns_topic_arn` in terraform.tfvars

## Troubleshooting

### ECS Tasks Failing
```bash
# View task logs
aws ecs describe-tasks --cluster cht-platform-dev-cluster --tasks <task-id>

# Check CloudWatch logs
aws logs tail /ecs/cht-platform-dev --since 1h
```

### Database Connection Issues
```bash
# Verify security groups
aws ec2 describe-security-groups --filters "Name=tag:Environment,Values=dev"

# Test from ECS task
aws ecs execute-command --cluster cht-platform-dev-cluster \
  --task <task-arn> --container backend --interactive \
  --command "psql $DATABASE_URL -c 'SELECT 1'"
```

### Update Infrastructure
```bash
# Pull latest images
./scripts/build-images.sh v1.1.0
./scripts/push-images.sh v1.1.0

# Update terraform.tfvars with new image tags

# Apply changes
./scripts/deploy.sh dev apply
```

## Cost Management

### Current Monthly Costs (Dev)

- ECS Fargate: ~$22
- RDS: ~$15
- ElastiCache: ~$12
- NAT Gateway: ~$65
- ALB: ~$20
- Other: ~$6
- **Total: ~$140/month**

### Cost Optimization

1. **Use 1 NAT Gateway** instead of 2 (save $32/month)
2. **Use FARGATE_SPOT** for non-critical tasks (save 50%)
3. **Schedule dev environment** to run 9am-6pm only
4. **Use Reserved Instances** for production

## Cleanup
```bash
# ⚠️  WARNING: This deletes everything!

# Destroy infrastructure
./scripts/deploy.sh dev destroy

# Delete ECR repositories
aws ecr delete-repository --repository-name cht-platform-backend --force
aws ecr delete-repository --repository-name cht-platform-worker --force

# Delete S3 buckets
aws s3 rb s3://cht-platform-dev-frontend --force
aws s3 rb s3://cht-platform-dev-certificates --force
```

## Support

For issues or questions:
1. Check CloudWatch logs
2. Review Terraform state: `terraform show`
3. Contact DevOps team
