# CHT Platform Infrastructure

Complete AWS infrastructure for the CHT Platform using Terraform.

## Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    CloudFront (Frontend)                     │
│                 S3 Static Website Hosting                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │  Application Load Balancer  │
        │       (HTTPS/HTTP)          │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌─────────────────────────────┐
        │     ECS Fargate Cluster     │
        │  ┌────────────────────────┐ │
        │  │  Backend Service (2+)  │ │
        │  │  - NestJS API          │ │
        │  │  - Auto-scaling        │ │
        │  └────────────────────────┘ │
        │  ┌────────────────────────┐ │
        │  │  Worker Service (1+)   │ │
        │  │  - Python Workers      │ │
        │  │  - SQS Consumers       │ │
        │  └────────────────────────┘ │
        └──────────┬──────────┬───────┘
                   │          │
        ┌──────────▼─────┐ ┌─▼──────────────┐
        │  RDS Postgres  │ │ ElastiCache    │
        │  (Encrypted)   │ │ Redis (KMS)    │
        └────────────────┘ └────────────────┘
                   
        ┌────────────────────────────────────┐
        │         SQS Queues (KMS)           │
        │  - Email Queue                     │
        │  - Payment Queue                   │
        │  - CME Certificate Queue           │
        └────────────────────────────────────┘

        ┌────────────────────────────────────┐
        │         S3 Buckets (KMS)           │
        │  - Frontend Static Files           │
        │  - CME Certificates                │
        └────────────────────────────────────┘
```

## Modules

### Security
- **KMS**: Encryption keys for all services
- **Secrets Manager**: Secure credential storage
- **IAM**: Roles and policies for ECS tasks

### Networking
- **VPC**: Private network with public/private subnets
- **ALB**: Application Load Balancer with HTTPS
- **CloudFront**: CDN for frontend distribution

### Compute
- **ECS Cluster**: Fargate cluster for containers
- **Backend Service**: NestJS API with auto-scaling
- **Worker Service**: Python workers with SQS auto-scaling

### Database
- **RDS PostgreSQL**: Encrypted database with automated backups

### Cache
- **ElastiCache Redis**: Encrypted Redis cluster

### Storage
- **S3 Frontend**: Static website hosting
- **S3 Certificates**: CME certificate storage

### Messaging
- **SQS Queues**: Email, Payment, and CME queues with DLQs

### Monitoring
- **CloudWatch**: Dashboards, alarms, and log aggregation

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **Terraform** >= 1.0
3. **AWS CLI** configured
4. **Docker images** pushed to ECR
5. **S3 bucket** for Terraform state (create manually first)

## Quick Start

### 1. Create Terraform State Backend
```bash
# Create S3 bucket for state
aws s3 mb s3://cht-platform-terraform-state-dev --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket cht-platform-terraform-state-dev \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name cht-platform-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 2. Configure Variables
```bash
cd environments/dev
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
nano terraform.tfvars
```

### 3. Deploy Infrastructure
```bash
# Initialize Terraform
./scripts/deploy.sh dev init

# Plan changes
./scripts/deploy.sh dev plan

# Apply changes
./scripts/deploy.sh dev apply
```

## Environment Variables

Sensitive values can be set via environment variables:
```bash
export TF_VAR_gotrue_jwt_secret="..."
export TF_VAR_bill_dev_key="..."
# Email via Amazon SES - worker uses IAM role, verify domain in SES
```

## Outputs

After deployment, retrieve outputs:
```bash
cd environments/dev
terraform output
```

Important outputs:
- `alb_dns_name`: Backend API endpoint
- `cloudfront_domain_name`: Frontend URL
- `email_queue_url`: Email SQS queue
- `payment_queue_url`: Payment SQS queue
- `cme_queue_url`: CME SQS queue

## Cost Estimation (Dev Environment)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| ECS Fargate (Backend) | 2 tasks × 0.25 vCPU | ~$15 |
| ECS Fargate (Worker) | 1 task × 0.25 vCPU | ~$7 |
| RDS db.t3.micro | Single-AZ, 20GB | ~$15 |
| ElastiCache cache.t3.micro | Single node | ~$12 |
| ALB | Standard | ~$20 |
| NAT Gateway | 2 AZs | ~$65 |
| S3 + CloudFront | Light usage | ~$5 |
| SQS | Light usage | <$1 |
| **Total** | | **~$140/month** |

**Cost Optimization Tips:**
- Use 1 NAT Gateway instead of 2: Save $32.50/month
- Use FARGATE_SPOT: Save ~50% on compute
- Reserved instances for prod: Save ~40%

## Deployment Order

Terraform handles dependencies automatically, but this is the logical order:

1. KMS keys
2. VPC and networking
3. RDS and ElastiCache
4. S3 buckets
5. SQS queues
6. Secrets Manager
7. IAM roles
8. ALB
9. ECS cluster
10. ECS services
11. CloudFront
12. CloudWatch

## Cleanup
```bash
# Destroy all infrastructure
./scripts/deploy.sh dev destroy
```

⚠️ **Warning**: This will delete ALL resources including databases!

## Production Deployment

1. Copy dev environment:
```bash
cp -r environments/dev environments/prod
```

2. Update `environments/prod/main.tf`:
   - Change `environment = "prod"`
   - Enable Multi-AZ for RDS
   - Increase task counts
   - Enable deletion protection

3. Deploy:
```bash
./scripts/deploy.sh prod apply
```

## Troubleshooting

### ECS Tasks Not Starting
- Check CloudWatch logs: `/ecs/cht-platform-{env}`
- Verify secrets exist in Secrets Manager
- Check security groups allow traffic

### Database Connection Failed
- Verify RDS security group allows ECS
- Check DATABASE_URL in secrets
- Confirm private subnets can reach RDS

### Redis Connection Failed
- Verify ElastiCache security group
- Check REDIS_HOST/PORT in secrets

## Support

For issues, see `/docs` directory or contact the DevOps team.
