# CHT Platform – Deploy Frontend & Backend

Quick steps to deploy the frontend and backend to **testapp.communityhealth.media**.

---

## Prerequisites

- AWS CLI configured
- Docker installed
- Terraform initialized
- Node.js 18+ (for frontend build)

---

## First-time setup (one-time)

### 1. Create ECR repositories

```bash
./scripts/setup-ecr.sh us-east-1
```

### 2. Build Docker images

```bash
./scripts/build-images.sh v1.0.0
```

### 3. Push images to ECR

```bash
./scripts/push-images.sh v1.0.0 us-east-1
```

### 4. Configure Terraform variables

```bash
cp infrastructure/terraform/environments/variables/platform.tfvars.example infrastructure/terraform/environments/variables/platform.tfvars
# Edit platform.tfvars with your values (backend_image, worker_image, secrets, etc.)
```

### 5. Deploy infrastructure (Terraform)

```bash
./scripts/deploy-primary.sh platform
```

### 6. Run database migrations

```bash
./scripts/run-migrations.sh platform
```

---

## Deploy backend

```bash
# Build, push, and deploy backend + worker to ECS
./scripts/deploy-ecs-services.sh platform v1.0.0
```

**Options:**
- `platform` – use platform config (testapp.communityhealth.media)
- `v1.0.0` – image tag (default: v1.0.0)
- `--stop-first` – scale to 0 before deploy (useful for troubleshooting)

**Verify:**

```bash
curl https://testapp.communityhealth.media/health/ready
```

---

## Deploy frontend

```bash
./scripts/deploy-frontend.sh platform
```

**Requirements:**
- AWS Secrets Manager secret `cht-platform-app-secrets` with:
  - `supabase_url`
  - `supabase_anon_key`
- Terraform must be applied (S3 bucket and CloudFront exist)

**Verify:**

```bash
open https://testapp.communityhealth.media
```

---

## Deploy both (backend + frontend)

```bash
# 1. Deploy backend
./scripts/deploy-ecs-services.sh platform v1.0.0

# 2. Deploy frontend
./scripts/deploy-frontend.sh platform
```

---

## Environment variants

| Environment | Script arg | Domain |
|-------------|------------|--------|
| Platform (single consolidated) | `platform` | testapp.communityhealth.media |
| Dev | `dev` | (dev-specific) |
| Prod | `prod` | (prod-specific) |

---

## Troubleshooting

| Issue | Action |
|-------|--------|
| Frontend build fails | Ensure `cht-platform-app-secrets` has `supabase_url` and `supabase_anon_key` |
| Backend 502 | Check ECS tasks are running; CloudWatch logs for backend |
| Terraform not initialized | Run `cd infrastructure/terraform/environments/us-east-1 && terraform init` |
| Migrations not run | Run `./scripts/run-migrations.sh platform` |
