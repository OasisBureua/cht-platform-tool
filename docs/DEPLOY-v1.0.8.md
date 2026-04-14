# Deploy v1.0.8 – Step-by-Step

## Prerequisites

- AWS CLI configured (`aws sts get-caller-identity` works)
- Docker installed and running
- Node.js 18+ (for frontend build)

## Target

- **Platform:** testapp.communityhealth.media
- **Version:** v1.0.8

---

## 1. Build Docker images

```bash
./scripts/build-images.sh v1.0.8
```

This builds:
- `cht-platform-backend:v1.0.8`
- `cht-platform-worker:v1.0.8`

---

## 2. Push images to ECR

```bash
./scripts/push-images.sh v1.0.8 us-east-1
```

---

## 3. Deploy backend & worker to ECS

```bash
./scripts/deploy-ecs-services.sh platform v1.0.8
```

This script will:
- Update `platform.tfvars` with the new image tags
- Run `terraform apply` for ECS tasks
- Force ECS to pull new images and redeploy
- Wait for services to stabilize

---

## 4. Deploy frontend to S3/CloudFront

```bash
./scripts/deploy-frontend.sh platform
```

This will:
- Build the frontend with production API URL
- Upload to S3
- Invalidate CloudFront cache

---

## 5. Verify deployment

```bash
# Health check
curl https://testapp.communityhealth.media/health/ready

# Open in browser
open https://testapp.communityhealth.media
```

---

## Optional: Run migrations

If there are new migrations:

```bash
./scripts/run-migrations.sh platform
```

---

## Quick one-liner (all steps)

```bash
./scripts/build-images.sh v1.0.8 && \
./scripts/push-images.sh v1.0.8 us-east-1 && \
./scripts/deploy-ecs-services.sh platform v1.0.8 && \
./scripts/deploy-frontend.sh platform
```

---

## Troubleshooting

| Issue | Action |
|-------|--------|
| ECR login failed | `aws ecr get-login-password --region us-east-1 \| docker login --username AWS --password-stdin 233636046512.dkr.ecr.us-east-1.amazonaws.com` |
| ECS tasks not updating | Run `./scripts/deploy-ecs-services.sh platform v1.0.8` again (force-new-deployment) |
| Frontend not updating | CloudFront cache invalidation can take 1–2 minutes |
| Port 3000 in use | `lsof -i :3000` then `kill <PID>` |
