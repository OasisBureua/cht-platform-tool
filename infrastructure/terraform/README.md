# CHT Platform Infrastructure

Terraform infrastructure for CHT Platform - Healthcare professional CME platform.

## 📁 Project Structure
```
infrastructure/terraform/
├── modules/
│   ├── secrets/       # AWS Secrets Manager
│   ├── networking/    # VPC, Security Groups, ALB
│   ├── compute/       # ECS Fargate + ECR
│   ├── database/      # RDS Aurora PostgreSQL + Redis
│   ├── storage/       # S3 buckets
│   └── iam/           # IAM roles and policies
├── variables/
│   ├── dev.tfvars     # Development environment
│   ├── test.tfvars    # Testing/Staging environment
│   └── prod.tfvars    # Production environment
├── main.tf            # Root module configuration
├── variables.tf       # Variable definitions
├── outputs.tf         # Output values
├── backend.tf         # Terraform state backend
└── README.md          # This file
```

## 🏗️ Infrastructure Components

### Networking
- VPC with public and private subnets across 2 AZs
- Internet Gateway and NAT Gateway
- Application Load Balancer (ALB)
- Security Groups (ALB, ECS, RDS, Redis)

### Compute
- ECR repository for Docker images
- ECS Fargate cluster
- ECS service with auto-scaling
- CloudWatch logs

### Database
- RDS Aurora PostgreSQL Serverless v2
- ElastiCache Redis
- Automated backups

### Storage
- S3 bucket for file uploads (W-9s, transcripts)
- S3 bucket for logs
- Lifecycle policies

### Security
- AWS Secrets Manager for sensitive data
- IAM roles for ECS tasks
- Encrypted storage (S3, RDS, Redis)

## 🚀 Prerequisites

1. **AWS CLI** configured with credentials
```bash
   aws configure
```

2. **Terraform** installed (v1.5+)
```bash
   terraform --version
```

3. **Docker** installed (for building images)
```bash
   docker --version
```

4. **Generate secure secrets** for your environment:
```bash
   # Generate a strong database password
   openssl rand -base64 32

   # Generate JWT secret
   openssl rand -base64 64
```

## 📝 Initial Setup

### Step 1: Set Environment Variables

Create a `.env` file (DON'T commit this):
```bash
# Copy example
cp .env.example .env

# Edit with your secrets
nano .env
```

Example `.env` file:
```bash
# Database
export TF_VAR_db_master_password="your-strong-password-here"

# Application Secrets
export TF_VAR_jwt_secret="your-jwt-secret-here"
export TF_VAR_auth_client_id="your-auth-client-id"
export TF_VAR_auth_client_secret="your-auth-secret"
export TF_VAR_stripe_secret_key="sk_test_..."
export TF_VAR_stripe_webhook_secret="whsec_..."
export TF_VAR_vimeo_access_token="your-vimeo-token"
export TF_VAR_youtube_api_key="your-youtube-key"
```

Load the environment variables:
```bash
source .env
```

### Step 2: Initialize Terraform
```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init
```

### Step 3: Choose Your Environment
```bash
# For Development
export ENV=dev

# For Test/Staging
export ENV=test

# For Production
export ENV=prod
```

## 🎯 Deployment Commands

### Plan (Preview Changes)
```bash
terraform plan -var-file="variables/${ENV}.tfvars"
```

### Apply (Deploy Infrastructure)
```bash
terraform apply -var-file="variables/${ENV}.tfvars"
```

### Destroy (Tear Down Infrastructure)
```bash
terraform destroy -var-file="variables/${ENV}.tfvars"
```

## 🐳 Deploying Your Application

After infrastructure is created, deploy your Docker container:

### Step 1: Build Docker Image
```bash
cd ../../backend

docker build -t cht-platform-backend:latest .
```

### Step 2: Tag and Push to ECR
```bash
# Get ECR repository URL from Terraform output
ECR_URL=$(terraform -chdir=../infrastructure/terraform output -raw ecr_repository_url)

# Tag image
docker tag cht-platform-backend:latest ${ECR_URL}:backend-latest

# Authenticate Docker to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin ${ECR_URL}

# Push image
docker push ${ECR_URL}:backend-latest
```

### Step 3: Update ECS Service
```bash
# Get cluster and service names
CLUSTER=$(terraform -chdir=../infrastructure/terraform output -raw ecs_cluster_name)
SERVICE=$(terraform -chdir=../infrastructure/terraform output -raw ecs_service_name)

# Force new deployment
aws ecs update-service \
  --cluster ${CLUSTER} \
  --service ${SERVICE} \
  --force-new-deployment \
  --region us-east-1
```

### Step 4: Access Your Application
```bash
# Get ALB URL
terraform -chdir=infrastructure/terraform output alb_url
```

## 🔧 Common Operations

### View Outputs
```bash
terraform output
```

### View Specific Output
```bash
terraform output alb_dns_name
terraform output ecr_repository_url
```

### Check ECS Service Status
```bash
aws ecs describe-services \
  --cluster $(terraform output -raw ecs_cluster_name) \
  --services $(terraform output -raw ecs_service_name) \
  --region us-east-1
```

### View ECS Logs
```bash
aws logs tail /aws/ecs/cht-platform/${ENV}/backend --follow
```

### Connect to Database (via Bastion or Secrets Manager)
```bash
# Get database endpoint
DB_ENDPOINT=$(terraform output -raw postgres_endpoint)

# Connect using psql (requires bastion or VPN)
psql -h ${DB_ENDPOINT} -U postgres -d cht_platform
```

## 🔐 Security Best Practices

1. **Never commit secrets** to version control
2. **Use different passwords** for each environment
3. **Enable MFA** on AWS accounts
4. **Rotate secrets** regularly
5. **Review security groups** periodically
6. **Enable CloudTrail** for audit logging
7. **Use HTTPS** in production (configure ACM certificate)

## 💰 Cost Optimization

### Development Environment
- Disable NAT Gateway (`enable_nat_gateway = false`)
- Use single RDS instance
- Use single Redis node
- Disable Container Insights
- Short log retention

### Production Environment
- Enable Multi-AZ for high availability
- Use appropriate instance sizes
- Enable backups and disaster recovery
- Monitor costs with AWS Cost Explorer

## 🐛 Troubleshooting

### Terraform Init Fails
```bash
rm -rf .terraform .terraform.lock.hcl
terraform init
```

### ECS Tasks Not Starting
```bash
# Check task logs
aws ecs describe-tasks \
  --cluster $(terraform output -raw ecs_cluster_name) \
  --tasks <task-id> \
  --region us-east-1
```

### Can't Connect to Database
- Verify security groups allow traffic
- Check if NAT Gateway is enabled for private subnets
- Verify RDS is in correct subnets

### High Costs
```bash
# Check what's running
aws ecs list-services --cluster $(terraform output -raw ecs_cluster_name)
aws rds describe-db-clusters
aws elasticache describe-replication-groups
```

## 📊 Monitoring

### CloudWatch Dashboards
- ECS metrics (CPU, Memory, Task count)
- RDS metrics (Connections, CPU, Storage)
- ALB metrics (Request count, Latency, Status codes)

### Alarms (Configure in AWS Console)
- ECS task failure
- RDS high CPU
- ALB 5xx errors
- High costs

## 🔄 CI/CD Integration

Example GitHub Actions workflow:
```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Build and push Docker image
        run: |
          # Add your build commands here
```

## 📚 Additional Resources

- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [RDS Aurora Serverless](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html)

## 🆘 Support

For issues or questions:
1. Check AWS Console for detailed error messages
2. Review CloudWatch logs
3. Contact DevOps team

---

**Environment Status:**
- 🟢 Dev: Active
- 🟡 Test: Staging
- 🔴 Prod: Not yet deployed
