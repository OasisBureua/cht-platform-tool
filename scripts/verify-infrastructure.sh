#!/bin/bash

# Detect project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

echo "🔍 CHT Platform - Infrastructure Verification"
echo "=============================================="
echo ""
echo "📂 Project root: $PROJECT_ROOT"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

ERRORS=0

# Check module structure
echo "📦 Checking module structure..."

REQUIRED_MODULES=(
  "networking/vpc"
  "networking/alb"
  "networking/cloudfront"
  "networking/route53"
  "compute/ecs-cluster"
  "compute/ecs-backend"
  "compute/ecs-worker"
  "database/rds"
  "cache/elasticache"
  "storage/s3-frontend"
  "storage/s3-certificates"
  "security/kms"
  "security/iam"
  "security/secrets-manager"
  "messaging/sqs"
  "monitoring/cloudwatch"
)

for module in "${REQUIRED_MODULES[@]}"; do
  MODULE_PATH="infrastructure/terraform/modules/$module"
  
  if [ -d "$MODULE_PATH" ]; then
    # Check for required files
    if [ -f "$MODULE_PATH/main.tf" ] && \
       [ -f "$MODULE_PATH/variables.tf" ] && \
       [ -f "$MODULE_PATH/outputs.tf" ]; then
      echo "  ✅ $module"
    else
      echo "  ⚠️  $module (missing files)"
      ERRORS=$((ERRORS + 1))
    fi
  else
    echo "  ❌ $module (missing)"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
echo "📁 Checking environment structure..."

# Check environments
if [ -d "infrastructure/terraform/environments/us-east-1" ]; then
  echo "  ✅ environments/us-east-1"
else
  echo "  ❌ environments/us-east-1 (missing)"
  ERRORS=$((ERRORS + 1))
fi

if [ -d "infrastructure/terraform/environments/us-east-2" ]; then
  echo "  ✅ environments/us-east-2"
else
  echo "  ❌ environments/us-east-2 (missing)"
  ERRORS=$((ERRORS + 1))
fi

if [ -d "infrastructure/terraform/environments/variables" ]; then
  echo "  ✅ environments/variables"
  
  if [ -f "infrastructure/terraform/environments/variables/dev.tfvars" ]; then
    echo "    ✅ dev.tfvars"
  else
    echo "    ❌ dev.tfvars (missing)"
    ERRORS=$((ERRORS + 1))
  fi
  
  if [ -f "infrastructure/terraform/environments/variables/prod.tfvars" ]; then
    echo "    ✅ prod.tfvars"
  else
    echo "    ❌ prod.tfvars (missing)"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  ❌ environments/variables (missing)"
  ERRORS=$((ERRORS + 1))
fi

echo ""
echo "🔧 Checking scripts..."

REQUIRED_SCRIPTS=(
  "scripts/deploy-primary.sh"
  "scripts/deploy-frontend.sh"
  "scripts/run-migrations.sh"
  "scripts/build-images.sh"
  "scripts/push-images.sh"
  "scripts/test-health.sh"
)

for script in "${REQUIRED_SCRIPTS[@]}"; do
  if [ -f "$script" ] && [ -x "$script" ]; then
    echo "  ✅ $script"
  elif [ -f "$script" ]; then
    echo "  ⚠️  $script (not executable)"
    chmod +x "$script"
    echo "    → Fixed: made executable"
  else
    echo "  ❌ $script (missing)"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
echo "📚 Checking documentation..."

REQUIRED_DOCS=(
  "README.md"
  "COMPLETE-DEPLOYMENT-GUIDE.md"
  "TESTING-CHECKLIST.md"
  "DISASTER-RECOVERY-MANUAL-FAILOVER.md"
)

for doc in "${REQUIRED_DOCS[@]}"; do
  if [ -f "$doc" ]; then
    echo "  ✅ $doc"
  else
    echo "  ⚠️  $doc (missing)"
  fi
done

echo ""
echo "🏗️  Checking Terraform validity..."

if [ -d "infrastructure/terraform/environments/us-east-1" ]; then
  cd infrastructure/terraform/environments/us-east-1

  if terraform init -backend=false > /dev/null 2>&1; then
    echo "  ✅ Terraform initialization successful"
    
    if terraform validate > /dev/null 2>&1; then
      echo "  ✅ Terraform configuration valid"
    else
      echo "  ❌ Terraform validation failed"
      terraform validate
      ERRORS=$((ERRORS + 1))
    fi
  else
    echo "  ❌ Terraform initialization failed"
    ERRORS=$((ERRORS + 1))
  fi

  cd "$PROJECT_ROOT"
else
  echo "  ⚠️  Skipping Terraform validation (us-east-1 not found)"
fi

echo ""
echo "=============================================="

if [ $ERRORS -eq 0 ]; then
  echo "✅ All checks passed! Infrastructure is ready."
  echo ""
  echo "📋 Next steps:"
  echo "1. Request SSL certificates: ./scripts/request-certificates-communityhealth.sh"
  echo "2. Build images: ./scripts/build-images.sh v1.0.0"
  echo "3. Push images: ./scripts/push-images.sh v1.0.0 us-east-1"
  echo "4. Deploy: ./scripts/deploy-primary.sh dev"
  exit 0
else
  echo "❌ Found $ERRORS error(s). Please fix before deploying."
  echo ""
  echo "💡 Tip: Run from project root:"
  echo "   cd $PROJECT_ROOT"
  echo "   ./scripts/verify-infrastructure.sh"
  exit 1
fi