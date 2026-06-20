#!/bin/bash
# Destroy us-east-2 DR standby stack for an environment (dev or platform).
set -euo pipefail

ENV=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/${ENV}.tfvars"
TF_DIR="$REPO_ROOT/infrastructure/terraform/environments/us-east-2"

case "$ENV" in
  platform|dev) ;;
  *)
    echo "Usage: ./destroy-secondary.sh [dev|platform]"
    exit 1
    ;;
esac

case "$ENV" in
  platform) BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-2-platform.hcl" ;;
  dev)      BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-2-dev.hcl" ;;
esac

read_tfvar() {
  grep -E "^${1}[[:space:]]*=" "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/'
}

TF_BACKEND_IMAGE=$(read_tfvar backend_image)
TF_WORKER_IMAGE=$(read_tfvar worker_image)

echo "🗑️  Destroy DR stack: us-east-2 / ${ENV}"
echo "============================================"
echo ""

cd "$TF_DIR"
terraform init -reconfigure -backend-config="$BACKEND_CONFIG" >/dev/null
terraform validate

terraform destroy \
  -var-file="../variables/${ENV}.tfvars" \
  -var="backend_image=${TF_BACKEND_IMAGE}" \
  -var="worker_image=${TF_WORKER_IMAGE}" \
  -auto-approve

echo ""
echo "✅ us-east-2 (${ENV}) destroyed."
echo ""
echo "Next: clear secondary_api_origin_domain in ${ENV}.tfvars and re-apply us-east-1:"
echo "  ./scripts/deploy-primary.sh ${ENV}"
