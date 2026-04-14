# Deploying to Dev Without ACM Certificate

Use this guide when the ACM certificate is still pending and you want to test infra beyond local.

## Current Dependencies on ACM

| Component | ACM Required? | Notes |
|-----------|---------------|-------|
| **VPC** | No | Deploy anytime |
| **RDS** | No | Deploy anytime |
| **ElastiCache** | No | Deploy anytime |
| **SQS** | No | Deploy anytime |
| **S3** (frontend, certificates) | No | Deploy anytime |
| **Secrets Manager** | No | Deploy anytime |
| **KMS** | No | Deploy anytime |
| **IAM** | No | Deploy anytime |
| **ALB** | **Yes** | HTTPS listener requires ACM; HTTP listener redirects to 443 |
| **ECS Cluster** | No | Deploy anytime |
| **ECS Backend** | **Yes** | Needs ALB target group (ALB must exist) |
| **ECS Worker** | No | No direct ALB dependency |
| **CloudFront** | No* | Can use default *.cloudfront.net cert; custom domain needs ACM |
| **Route53** | **Yes** | Health check uses HTTPS:443; needs ALB HTTPS |

\* CloudFront works without custom ACM—you get `xxxxx.cloudfront.net` URL.

## Option A: Deploy Core Infra Only (No ALB/Route53/CloudFront)

Deploy everything except components that depend on ACM:

1. **Modify** `environments/us-east-1/main.tf` temporarily:
   - Comment out or remove: `module "alb"`, `module "ecs_cluster"`, `module "ecs_backend"`, `module "ecs_worker"`, `module "cloudfront"`, `module "route53"`, `module "cloudwatch"`.
   - Keep: VPC, RDS, ElastiCache, SQS, S3, Secrets, IAM, KMS.

2. **Run**:
   ```bash
   cd infrastructure/terraform/environments/us-east-1
   terraform init
   terraform plan -var-file=../variables/dev.tfvars
   terraform apply -var-file=../variables/dev.tfvars
   ```

3. **Result**: You get RDS, Redis, SQS, S3. You can:
   - Connect to RDS from your machine (via VPN/bastion or public access if enabled)
   - Run backend + worker locally, pointing to AWS RDS, Redis, SQS
   - Test the full flow: local backend → AWS SQS → local worker → AWS RDS

## Option B: ALB HTTP-Only Mode (Implemented)

When `acm_certificate_arn` is empty in your tfvars:
- ALB listens on HTTP (80) and **forwards** to backend (no redirect)
- ECS backend + worker can be deployed
- API reachable via `http://<alb-dns-name>/api/...`

**To use**: Set `acm_certificate_arn = ""` and `cloudfront_certificate_arn = ""` in `dev.tfvars`, then apply. Full stack (including ECS, CloudFront, Route53) will deploy.

**Caveat**: Route53 health check uses HTTPS:443 and will fail (no listener on 443). API still works; use ALB DNS directly or accept failing health alarms.

**Security**: HTTP-only is insecure. Use only for short-lived dev testing.

## Option C: Wait for ACM, Then Full Deploy

Once the ACM certificate is validated:
1. Add cert ARN to `dev.tfvars`: `acm_certificate_arn` and `cloudfront_certificate_arn`
2. Run full `terraform apply`
3. Deploy frontend to S3, backend/worker to ECS
4. Access via `https://app.domain` and `https://api.domain`

## Recommended: Option A for Now

Deploy VPC, RDS, ElastiCache, SQS, S3, Secrets, IAM, KMS. Then run backend and worker locally with `.env` pointing to AWS services. This lets you validate:
- Database connectivity
- Redis connectivity  
- SQS message flow (survey completion → payment queue → worker)
- End-to-end without needing ACM or ECS

When ACM is ready, add the remaining modules and run apply again.
