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

# Both clusters can run the same ECR images (override with BACKEND_IMAGE / WORKER_IMAGE / IMAGE_TAG).
ECR_REGISTRY="${ECR_REGISTRY:-233636046512.dkr.ecr.us-east-1.amazonaws.com}"
IMAGE_TAG="${IMAGE_TAG:-platform-latest}"
BACKEND_IMAGE="${BACKEND_IMAGE:-${ECR_REGISTRY}/cht-platform-backend:${IMAGE_TAG}}"
WORKER_IMAGE="${WORKER_IMAGE:-${ECR_REGISTRY}/cht-platform-worker:${IMAGE_TAG}}"

DOMAIN=$(grep -E '^domain_name[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')

echo "📦 Environment: $ENV"
echo "📄 Variables:  ${ENV}.tfvars"
echo "🌐 Domain:      ${DOMAIN:-unknown}"
echo "🐳 Backend:     $BACKEND_IMAGE"
echo "🐳 Worker:      $WORKER_IMAGE"
echo ""

cd "$REPO_ROOT/infrastructure/terraform/environments/us-east-1"

echo "🔧 Initializing Terraform..."
terraform init -reconfigure

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
