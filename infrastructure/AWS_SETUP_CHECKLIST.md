# AWS Setup Checklist

## 📋 What You Need Before Deploying

### 1. AWS Account
- [ ] Create AWS account at https://aws.amazon.com
- [ ] Verify email address
- [ ] Add payment method
- [ ] Set up MFA (Multi-Factor Authentication) for root account

### 2. IAM User Setup
- [ ] Create IAM user for Terraform (not root user!)
- [ ] Attach policies to IAM user:
  - `AdministratorAccess` (for initial setup, can be restricted later)
  - Or create custom policy with these permissions:
    - EC2, ECS, ECR
    - RDS, ElastiCache
    - S3, Secrets Manager
    - IAM (for role creation)
    - VPC, Security Groups
    - Application Load Balancer
    - CloudWatch Logs

### 3. AWS CLI Configuration
```bash
# Install AWS CLI (if not already installed)
# macOS:
brew install awscli

# Verify installation
aws --version

# Configure AWS credentials
aws configure

# You'll be prompted for:
# - AWS Access Key ID: [from IAM user]
# - AWS Secret Access Key: [from IAM user]
# - Default region name: us-east-1
# - Default output format: json
```

### 4. Verify AWS Access
```bash
# Test AWS credentials
aws sts get-caller-identity

# Should return your AWS account ID and user ARN
```

### 5. Generate Secrets
```bash
cd infrastructure/terraform

# Generate secrets for your environment
./generate-secrets.sh local

# Edit the generated file to add your API keys
nano .env.local
```

### 6. Review Costs (Important!)
Before deploying, understand the costs:

**Development Environment (minimal):**
- RDS Aurora Serverless v2: ~$30-50/month
- ElastiCache Redis (t3.micro): ~$15/month
- ECS Fargate (1 task, 0.25vCPU, 512MB): ~$10/month
- ALB: ~$20/month
- S3, CloudWatch: ~$5-10/month
- **Total: ~$80-105/month**

**Test Environment:**
- RDS Aurora Serverless v2: ~$50-80/month
- ElastiCache Redis (t3.small, multi-AZ): ~$30/month
- ECS Fargate (2 tasks, 0.5vCPU, 1GB): ~$30/month
- NAT Gateway: ~$35/month
- ALB: ~$20/month
- S3, CloudWatch: ~$10-15/month
- **Total: ~$175-210/month**

**Production Environment:**
- RDS Aurora Serverless v2 (multi-AZ): ~$150-200/month
- ElastiCache Redis (t3.medium, 3 nodes): ~$90/month
- ECS Fargate (3 tasks, 1vCPU, 2GB): ~$100/month
- NAT Gateway: ~$35/month
- ALB: ~$20/month
- S3, CloudWatch: ~$15-25/month
- **Total: ~$410-470/month**

### 7. Set Up Billing Alerts
```bash
# Create billing alarm in AWS Console
# 1. Go to CloudWatch > Alarms
# 2. Create alarm for EstimatedCharges
# 3. Set threshold (e.g., $100 for dev)
# 4. Add email notification
```

---

## 🚀 Deployment Steps (When Ready)

### Initial Setup
```bash
cd infrastructure/terraform

# 1. Load secrets
source .env.local

# 2. Initialize Terraform
terraform init

# 3. Validate configuration
terraform validate

# 4. Plan deployment (review carefully!)
terraform plan -var-file="variables/local.tfvars"

# 5. Deploy infrastructure
terraform apply -var-file="variables/local.tfvars"
```

### After Infrastructure is Created
```bash
# Get outputs
terraform output

# Note these important values:
# - ecr_repository_url
# - alb_dns_name
# - postgres_endpoint
# - redis_endpoint
```

### Deploy Backend Application
```bash
# 1. Build Docker image
cd ../../../backend
docker build -t cht-platform-backend:latest .

# 2. Get ECR URL
ECR_URL=$(terraform -chdir=../infrastructure/terraform output -raw ecr_repository_url)

# 3. Authenticate to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URL

# 4. Tag and push image
docker tag cht-platform-backend:latest ${ECR_URL}:backend-latest
docker push ${ECR_URL}:backend-latest

# 5. Update ECS service
CLUSTER=$(terraform -chdir=../infrastructure/terraform output -raw ecs_cluster_name)
SERVICE=$(terraform -chdir=../infrastructure/terraform output -raw ecs_service_name)

aws ecs update-service \
  --cluster $CLUSTER \
  --service $SERVICE \
  --force-new-deployment \
  --region us-east-1
```

### Run Database Migrations
```bash
# After ECS tasks are running, exec into a task to run migrations
TASK_ARN=$(aws ecs list-tasks --cluster $CLUSTER --service $SERVICE --query 'taskArns[0]' --output text)

# Run Prisma migrations
aws ecs execute-command \
  --cluster $CLUSTER \
  --task $TASK_ARN \
  --container backend \
  --interactive \
  --command "npx prisma migrate deploy"
```

---

## ⚠️ Important Security Notes

1. **Never commit secrets**
   - All `.env.*` files are gitignored
   - Keep your AWS credentials secure
   - Rotate passwords regularly

2. **Use different passwords per environment**
   - Local: Simple test passwords OK
   - Dev: Moderate security
   - Test: Good security
   - Prod: Strong, unique passwords

3. **Enable MFA on AWS account**
   - Especially important for production

4. **Review security groups**
   - Only allow necessary traffic
   - Restrict SSH/RDP access

5. **Monitor costs**
   - Set up billing alerts
   - Review AWS Cost Explorer weekly
   - Stop/destroy resources when not needed

---

## 🧹 Cleanup (When Done Testing)
```bash
# Destroy all resources (THIS WILL DELETE EVERYTHING!)
terraform destroy -var-file="variables/local.tfvars"

# Confirm by typing: yes
```

**Warning:** This will:
- Delete all data in databases
- Remove all S3 files
- Destroy all infrastructure
- Cannot be undone!

---

## 📞 Next Steps

1. **Get AWS credentials** from your team/organization
2. **Review this checklist** carefully
3. **Set up billing alerts** before deploying
4. **Start with local/dev environment** first
5. **Test thoroughly** before moving to production

---

## �� Troubleshooting

### "Access Denied" Errors
- Verify IAM user has correct permissions
- Check AWS credentials are loaded: `aws sts get-caller-identity`

### High Costs
- Check what resources are running
- Consider destroying dev environment when not in use
- Use `terraform plan` to preview changes

### Can't Connect to Database
- Security groups may need adjustment
- NAT Gateway required for private subnet outbound access
- Check VPC and subnet configuration

### ECS Tasks Failing
- Check CloudWatch logs: `/aws/ecs/cht-platform/local/backend`
- Verify Docker image pushed successfully
- Check secrets are configured correctly

---

## 📚 Resources

- [AWS Free Tier](https://aws.amazon.com/free/)
- [AWS Pricing Calculator](https://calculator.aws/)
- [Terraform AWS Provider Docs](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
