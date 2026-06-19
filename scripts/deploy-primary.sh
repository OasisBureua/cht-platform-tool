#!/bin/bash
set -e

echo "🚀 CHT Platform - Deploy Primary Region"
echo "========================================"
echo ""

# platform → platform.tfvars (testapp.communityhealth.media)
# dev      → dev.tfvars      (devapp.communityhealth.media)
ENV=${1:-platform}

case "$ENV" in
  platform|dev) ;;
  prod)
    ENV=platform
    ;;
  *)
    echo "❌ Unknown environment: $1"
    echo "Usage: ./deploy-primary.sh [platform|dev]"
    echo "  platform  uses infrastructure/terraform/environments/variables/platform.tfvars"
    echo "  dev       uses infrastructure/terraform/environments/variables/dev.tfvars"
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/${ENV}.tfvars"

if [ ! -f "$VAR_FILE" ]; then
    echo "❌ Variable file not found: $VAR_FILE"
    exit 1
fi

read_tfvar() {
    grep -E "^${1}[[:space:]]*=" "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/'
}

TF_BACKEND_IMAGE=$(read_tfvar backend_image)
TF_WORKER_IMAGE=$(read_tfvar worker_image)
if [ -z "$TF_BACKEND_IMAGE" ] || [ -z "$TF_WORKER_IMAGE" ]; then
    echo "❌ Could not read backend_image/worker_image from $VAR_FILE"
    exit 1
fi

# Use images from tfvars by default. Override with BACKEND_IMAGE / WORKER_IMAGE, or IMAGE_TAG + ECR_REGISTRY.
ECR_REGISTRY="${ECR_REGISTRY:-233636046512.dkr.ecr.us-east-1.amazonaws.com}"
if [ -n "$BACKEND_IMAGE" ]; then
    :
elif [ -n "$IMAGE_TAG" ]; then
    BACKEND_IMAGE="${ECR_REGISTRY}/cht-platform-backend:${IMAGE_TAG}"
else
    BACKEND_IMAGE="$TF_BACKEND_IMAGE"
fi
if [ -n "$WORKER_IMAGE" ]; then
    :
elif [ -n "$IMAGE_TAG" ]; then
    WORKER_IMAGE="${ECR_REGISTRY}/cht-platform-worker:${IMAGE_TAG}"
else
    WORKER_IMAGE="$TF_WORKER_IMAGE"
fi

DOMAIN=$(grep -E '^domain_name[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')

case "$ENV" in
  platform) BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-1-platform.hcl" ;;
  dev)      BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-1-dev.hcl" ;;
esac

echo "📦 Environment: $ENV"
echo "📄 Variables:  ${ENV}.tfvars"
echo "🗄️  State:       $(grep -E '^key' "$BACKEND_CONFIG" | sed 's/key = "//;s/"//')"
echo "🌐 Domain:      ${DOMAIN:-unknown}"
echo "🐳 Backend:     $BACKEND_IMAGE"
echo "🐳 Worker:      $WORKER_IMAGE"
echo ""

cd "$REPO_ROOT/infrastructure/terraform/environments/us-east-1"

echo "🔧 Initializing Terraform..."
terraform init -reconfigure -backend-config="$BACKEND_CONFIG"

echo ""
echo "✅ Validating configuration..."
terraform validate

echo ""
echo "📋 Planning deployment..."
terraform plan \
  -var-file="../variables/${ENV}.tfvars" \
  -var="backend_image=${BACKEND_IMAGE}" \
  -var="worker_image=${WORKER_IMAGE}" \
  -out=tfplan

echo ""
echo "📊 Plan Summary:"
terraform show -json tfplan | jq -r '.resource_changes[] | select(.change.actions != ["no-op"]) | "\(.change.actions[0]): \(.type).\(.name)"'
echo ""

read -p "Deploy to us-east-1 ($ENV)? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deployment cancelled."
    rm -f tfplan
    exit 0
fi

echo ""
echo "🚀 Deploying infrastructure..."
terraform apply tfplan
rm -f tfplan

ENABLE_COGNITO_MRR=$(grep -E '^enable_cognito_mrr[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^=]*=[[:space:]]*//' | tr '[:upper:]' '[:lower:]')
COGNITO_EMAIL_ACCOUNT=$(grep -E '^cognito_email_sending_account[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/' | tr '[:upper:]' '[:lower:]')
if [ "$ENABLE_COGNITO_MRR" = "true" ] || [ "$COGNITO_EMAIL_ACCOUNT" = "developer" ]; then
  echo ""
  echo "🔐 Syncing Cognito pool config (MRR-safe API)..."
  "$REPO_ROOT/scripts/cognito-sync-pool-config.sh" "$ENV"
fi

echo ""
echo "✅ us-east-1 ($ENV) deployed successfully!"
echo ""

echo "📋 Deployment Outputs:"
terraform output

echo ""
echo "💾 Saving outputs..."
terraform output > ~/cht-us-east-1-${ENV}-outputs.txt

echo ""
echo "📋 Next steps:"
echo "1. Add Route53 NS records to your DNS provider (if not already delegated)"
echo "2. Deploy DR standby: ./scripts/deploy-secondary.sh $ENV"
echo "3. Deploy frontend: ./scripts/deploy-frontend.sh $ENV both"
echo "4. Run database migrations: ./scripts/run-migrations.sh $ENV"
if [ -n "$DOMAIN" ]; then
  echo "5. Test: curl https://${DOMAIN}/health/ready"
else
  echo "5. Test: curl https://testapp.communityhealth.media/health/ready  # platform"
  echo "         curl https://devapp.communityhealth.media/health/ready    # dev"
fi
