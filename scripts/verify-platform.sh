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
  if [ "$CERT_STATUS" == "ISSUED" ]; then
    echo "  ✅ Certificate ISSUED"
  else
    echo "  ❌ Certificate status: $CERT_STATUS (need ISSUED)"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ .cert-arns-testapp not found"
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. platform.tfvars configuration
echo "2️⃣  platform.tfvars Configuration"
TFVARS="infrastructure/terraform/environments/variables/platform.tfvars"
if [ -f "$TFVARS" ]; then
  DOMAIN=$(grep -E '^\s*domain_name\s*=' "$TFVARS" | sed 's/.*"\([^"]*\)".*/\1/' | tr -d ' ')
  ACM_ARN=$(grep -E '^\s*acm_certificate_arn\s*=' "$TFVARS" | sed 's/.*"\([^"]*\)".*/\1/' | tr -d ' ')
  EXPECTED_DOMAIN="testapp.communityhealth.media"
  EXPECTED_ACM="arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"
  if [ "$DOMAIN" == "$EXPECTED_DOMAIN" ]; then
    echo "  ✅ domain_name = $DOMAIN"
  else
    echo "  ⚠️  domain_name = $DOMAIN (expected: $EXPECTED_DOMAIN)"
    echo "     Update platform.tfvars for testapp deployment"
  fi
  if [ "$ACM_ARN" == "$EXPECTED_ACM" ]; then
    echo "  ✅ acm_certificate_arn = testapp cert"
  else
    echo "  ⚠️  acm_certificate_arn may need update for testapp cert"
    echo "     Expected: $EXPECTED_ACM"
  fi
else
  if [ -f "infrastructure/terraform/environments/variables/platform.tfvars.example" ]; then
    echo "  ❌ platform.tfvars not found (gitignored - contains secrets)"
    echo "     Copy from example: cp infrastructure/terraform/environments/variables/platform.tfvars.example infrastructure/terraform/environments/variables/platform.tfvars"
    echo "     Then fill in supabase_anon_key, youtube_api_key, youtube_playlist_ids"
  else
    echo "  ❌ platform.tfvars not found"
  fi
  ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Infrastructure structure
echo "3️⃣  Infrastructure Structure"
./scripts/verify-infrastructure.sh || ERRORS=$((ERRORS + 1))
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

# 5. Terraform plan (dry run)
echo "5️⃣  Terraform Plan (dry run)"
cd infrastructure/terraform/environments/us-east-1
set +e
terraform init -input=false -reconfigure > /dev/null 2>&1
terraform plan -var-file="../variables/platform.tfvars" -input=false -detailed-exitcode 2>&1 | tee /tmp/tfplan-platform.log
PLAN_EXIT=${PIPESTATUS[0]}
set -e
if [ "$PLAN_EXIT" -eq 0 ]; then
  echo "  ✅ No changes (infrastructure up to date)"
elif [ "$PLAN_EXIT" -eq 2 ]; then
  echo "  ✅ Plan generated (changes detected)"
  echo "     Review: tail -50 /tmp/tfplan-platform.log"
else
  if grep -q "Backend initialization required" /tmp/tfplan-platform.log 2>/dev/null; then
    echo "  ⚠️  Terraform backend not initialized (run terraform init in us-east-1)"
    echo "     S3 state bucket may need to exist first"
  else
    echo "  ❌ Terraform plan failed"
    tail -20 /tmp/tfplan-platform.log
    ERRORS=$((ERRORS + 1))
  fi
fi
cd "$PROJECT_ROOT"
echo ""

# 6. ECR images (optional)
echo "6️⃣  Docker Images (ECR)"
BACKEND_IMAGE="233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:v1.0.0"
WORKER_IMAGE="233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:v1.0.0"
if aws ecr describe-images --repository-name cht-platform-backend --image-ids imageTag=v1.0.0 --region us-east-1 > /dev/null 2>&1; then
  echo "  ✅ cht-platform-backend:v1.0.0"
else
  echo "  ⚠️  cht-platform-backend:v1.0.0 not in ECR"
  echo "     Run: ./scripts/build-images.sh v1.0.0 && ./scripts/push-images.sh v1.0.0 us-east-1"
fi
if aws ecr describe-images --repository-name cht-platform-worker --image-ids imageTag=v1.0.0 --region us-east-1 > /dev/null 2>&1; then
  echo "  ✅ cht-platform-worker:v1.0.0"
else
  echo "  ⚠️  cht-platform-worker:v1.0.0 not in ECR"
fi
echo ""

# 7. Local backend health (optional)
echo "7️⃣  Local Backend Health (if running)"
if curl -sf --connect-timeout 2 http://localhost:3000/health > /dev/null 2>&1; then
  HEALTH=$(curl -s http://localhost:3000/health | jq -r '.status' 2>/dev/null || echo "unknown")
  if [ "$HEALTH" == "ok" ]; then
    echo "  ✅ Backend healthy at localhost:3000"
  else
    echo "  ⚠️  Backend responded but status: $HEALTH"
  fi
else
  echo "  ⏳ Backend not running locally (optional)"
fi
echo ""

echo "=============================================="
if [ $ERRORS -eq 0 ]; then
  echo "✅ Platform verification complete. Ready to deploy."
  echo ""
  echo "Next: ./scripts/deploy-primary.sh platform"
  exit 0
else
  echo "❌ Found $ERRORS issue(s). Fix before deploying."
  exit 1
fi
