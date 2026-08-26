#!/bin/bash
# Verify platform (single account) is ready for deployment (testapp.communityhealth.media)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

ERRORS=0

echo "🔍 CHT Platform - Platform Verification"
echo "=============================================="
echo ""

# 1. Certificate status (testapp)
echo "1️⃣  SSL Certificate (testapp.communityhealth.media)"
if [ -f "infrastructure/terraform/environments/variables/.cert-arns-testapp" ]; then
  source infrastructure/terraform/environments/variables/.cert-arns-testapp
  CERT_STATUS=$(aws acm describe-certificate \
    --certificate-arn "$certificate_arn" \
    --region us-east-1 \
    --query 'Certificate.Status' \
    --output text 2>/dev/null || echo "ERROR")
  if [ "$CERT_STATUS" = "ISSUED" ]; then
    echo "  ✅ Certificate ISSUED"
  else
    echo "  ❌ Certificate status: $CERT_STATUS (need ISSUED)"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ .cert-arns-testapp not found"
  echo "     Run: ./scripts/request-certificate-testapp.sh"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. platform.tfvars configuration
echo "2️⃣  platform.tfvars Configuration"
TFVARS="infrastructure/terraform/environments/variables/platform.tfvars"
if [ -f "$TFVARS" ]; then
  DOMAIN=$(grep -E '^\s*domain_name\s*=' "$TFVARS" | sed 's/.*"\([^"]*\)".*/\1/' | tr -d ' ')
  echo "  ✅ platform.tfvars found (domain: ${DOMAIN:-unknown})"
else
  if [ -f "infrastructure/terraform/environments/variables/platform.tfvars.example" ]; then
    echo "  ❌ platform.tfvars not found (gitignored - contains secrets)"
    echo "     cp infrastructure/terraform/environments/variables/platform.tfvars.example infrastructure/terraform/environments/variables/platform.tfvars"
  else
    echo "  ❌ platform.tfvars not found"
  fi
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Terraform modules and deploy scripts
echo "3️⃣  Infrastructure Structure"
REQUIRED_MODULES=(
  "networking/vpc" "networking/alb" "networking/cloudfront" "networking/route53"
  "compute/ecs-cluster" "compute/ecs-backend" "compute/ecs-worker"
  "database/rds" "storage/s3-frontend" "storage/s3-certificates"
  "security/kms" "security/iam" "security/secrets-manager" "messaging/sqs" "monitoring/cloudwatch"
)
for module in "${REQUIRED_MODULES[@]}"; do
  MODULE_PATH="infrastructure/terraform/modules/$module"
  if [ -f "$MODULE_PATH/main.tf" ] && [ -f "$MODULE_PATH/variables.tf" ] && [ -f "$MODULE_PATH/outputs.tf" ]; then
    echo "  ✅ $module"
  else
    echo "  ❌ $module (missing or incomplete)"
    ERRORS=$((ERRORS + 1))
  fi
done

REQUIRED_SCRIPTS=(
  "scripts/deploy-primary.sh" "scripts/deploy-frontend.sh" "scripts/run-migrations.sh"
  "scripts/build-images.sh" "scripts/push-images.sh"
)
for script in "${REQUIRED_SCRIPTS[@]}"; do
  if [ -f "$script" ]; then
    echo "  ✅ $script"
  else
    echo "  ❌ $script (missing)"
    ERRORS=$((ERRORS + 1))
  fi
done
echo ""

# 4. Terraform init + validate
echo "4️⃣  Terraform Configuration"
cd infrastructure/terraform/environments/us-east-1
if terraform init -backend=false -input=false > /dev/null 2>&1; then
  echo "  ✅ Terraform init OK"
  if terraform validate -json > /dev/null 2>&1; then
    echo "  ✅ Terraform validate OK"
  else
    echo "  ❌ Terraform validate failed"
    terraform validate
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ Terraform init failed"
  ERRORS=$((ERRORS + 1))
fi
cd "$PROJECT_ROOT"
echo ""

# 5. ECR images (optional)
echo "5️⃣  Docker Images (ECR)"
if aws ecr describe-images --repository-name cht-platform-backend --image-ids imageTag=latest --region us-east-1 > /dev/null 2>&1; then
  echo "  ✅ cht-platform-backend:latest in ECR"
else
  echo "  ⚠️  cht-platform-backend:latest not in ECR"
  echo "     Run: ./scripts/build-images.sh && ./scripts/push-images.sh"
fi
if aws ecr describe-images --repository-name cht-platform-worker --image-ids imageTag=latest --region us-east-1 > /dev/null 2>&1; then
  echo "  ✅ cht-platform-worker:latest in ECR"
else
  echo "  ⚠️  cht-platform-worker:latest not in ECR"
fi
echo ""

echo "=============================================="
if [ $ERRORS -eq 0 ]; then
  echo "✅ Platform verification complete. Ready to deploy."
  echo ""
  echo "Next:"
  echo "  ./scripts/build-images.sh v1.0.0"
  echo "  ./scripts/push-images.sh v1.0.0 us-east-1"
  echo "  ./scripts/deploy-primary.sh platform"
  echo "  ./scripts/deploy-frontend.sh platform"
  exit 0
else
  echo "❌ Found $ERRORS issue(s). Fix before deploying."
  exit 1
fi
