#!/bin/bash
set -e

echo "🚀 CHT Platform - Deploy Secondary Region (us-east-2 DR standby)"
echo "================================================================="
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
    echo "Usage: ./deploy-secondary.sh [platform|dev]"
    echo "  platform  uses infrastructure/terraform/environments/variables/platform.tfvars"
    echo "  dev       uses infrastructure/terraform/environments/variables/dev.tfvars"
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/${ENV}.tfvars"
TF_DIR="$REPO_ROOT/infrastructure/terraform/environments/us-east-2"

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

# DR pulls from us-east-2 ECR (replicated). Tag/repo come from tfvars unless overridden.
ECR_REGISTRY="${ECR_REGISTRY:-233636046512.dkr.ecr.us-east-2.amazonaws.com}"
dr_image() {
  local tf_image=$1
  local tag="${tf_image##*:}"
  local repo
  repo=$(basename "${tf_image%:*}")
  echo "${ECR_REGISTRY}/${repo}:${tag}"
}
if [ -n "$BACKEND_IMAGE" ]; then
  :
elif [ -n "$IMAGE_TAG" ]; then
  BACKEND_IMAGE="${ECR_REGISTRY}/cht-platform-backend:${IMAGE_TAG}"
else
  BACKEND_IMAGE=$(dr_image "$TF_BACKEND_IMAGE")
fi
if [ -n "$WORKER_IMAGE" ]; then
  :
elif [ -n "$IMAGE_TAG" ]; then
  WORKER_IMAGE="${ECR_REGISTRY}/cht-platform-worker:${IMAGE_TAG}"
else
  WORKER_IMAGE=$(dr_image "$TF_WORKER_IMAGE")
fi

DOMAIN=$(grep -E '^domain_name[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')

case "$ENV" in
  platform)
    BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-2-platform.hcl"
    ;;
  dev)
    BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-2-dev.hcl"
    ;;
esac

case "$ENV" in
  platform) EXPECTED_FRONTEND_BUCKET="cht-platform-dr-use2-frontend" ;;
  dev)      EXPECTED_FRONTEND_BUCKET="cht-dr-use2-dev-frontend" ;;
esac

echo "📦 Environment: $ENV"
echo "📄 Variables:  ${ENV}.tfvars"
echo "🗄️  State:       $(grep -E '^key' "$BACKEND_CONFIG" | sed 's/key = "//;s/"//')"
echo "🌐 Domain:      ${DOMAIN:-unknown}"
echo "🪣 DR frontend: $EXPECTED_FRONTEND_BUCKET"
echo "🐳 Backend:     $BACKEND_IMAGE"
echo "🐳 Worker:      $WORKER_IMAGE"
echo ""
echo "ℹ️  Prerequisite: primary us-east-1 must already be deployed for $ENV"
echo "   ./scripts/deploy-primary.sh $ENV"
echo "ℹ️  ECR images pull from us-east-2 (replicated from us-east-1 via platform apply)"
echo ""

cd "$TF_DIR"

"$REPO_ROOT/scripts/prepare-legacy-rds-decommission.sh" us-east-2 "$ENV"

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

read -p "Deploy to us-east-2 ($ENV)? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Deployment cancelled."
  rm -f tfplan
  exit 0
fi

echo ""
echo "🚀 Deploying DR standby infrastructure..."
terraform apply tfplan
rm -f tfplan

SECONDARY_ORIGIN=$(terraform output -raw secondary_api_origin_domain)
FRONTEND_BUCKET=$(terraform output -raw frontend_bucket 2>/dev/null || echo "$EXPECTED_FRONTEND_BUCKET")

terraform output > ~/cht-us-east-2-${ENV}-outputs.txt

cd "$REPO_ROOT"

echo ""
echo "✅ us-east-2 ($ENV) deployed successfully!"
echo ""
echo "📋 Key outputs:"
echo "   Secondary API origin: $SECONDARY_ORIGIN"
echo "   DR frontend bucket:   $FRONTEND_BUCKET"
echo "   Full outputs:         ~/cht-us-east-2-${ENV}-outputs.txt"
echo ""
echo "📋 Next steps:"
echo "1. In ${ENV}.tfvars (us-east-1), set CloudFront API failover:"
echo "     secondary_api_origin_domain = \"$SECONDARY_ORIGIN\""
echo "2. Re-apply primary: ./scripts/deploy-primary.sh $ENV"
echo "3. Deploy frontend to both buckets: ./scripts/deploy-frontend.sh $ENV both"
if [ -n "$DOMAIN" ]; then
  echo "4. DR smoke test: scale primary ECS to 0, then curl https://${DOMAIN}/health/ready"
fi
