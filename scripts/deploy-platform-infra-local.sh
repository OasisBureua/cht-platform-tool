#!/usr/bin/env bash
# Apply platform (testapp) infrastructure locally: one-time / infra changes only.
# App images + frontend are deployed via deploy-prod.yml (CI) after infra is in place.
#
# Prerequisites:
#   1. cp infrastructure/terraform/environments/variables/platform.tfvars.example \
#        infrastructure/terraform/environments/variables/platform.tfvars
#   2. Fill secrets in platform.tfvars OR export TF_VAR_* (see sync-github-secrets-from-tfvars.sh mappings)
#   3. aws configure / SSO with permission to apply platform state
#
# Usage:
#   ./scripts/deploy-platform-infra-local.sh          # plan + confirm + apply
#   ./scripts/deploy-platform-infra-local.sh plan-only
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$REPO_ROOT/infrastructure/terraform/environments/us-east-1"
VAR_FILE_COMMITTED="$REPO_ROOT/infrastructure/terraform/environments/variables/platform.github.tfvars"
VAR_FILE_SECRETS="$REPO_ROOT/infrastructure/terraform/environments/variables/platform.tfvars"
BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-1-platform.hcl"
PLAN_ONLY="${1:-}"

if [ ! -f "$VAR_FILE_COMMITTED" ]; then
  echo "❌ Missing $VAR_FILE_COMMITTED"
  exit 1
fi

read_tfvar() {
  grep -E "^${1}[[:space:]]*=" "$2" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/'
}

BACKEND_IMAGE=$(read_tfvar backend_image "$VAR_FILE_COMMITTED")
WORKER_IMAGE=$(read_tfvar worker_image "$VAR_FILE_COMMITTED")

VAR_FILES=(-var-file="../variables/platform.github.tfvars")
if [ -f "$VAR_FILE_SECRETS" ]; then
  VAR_FILES+=(-var-file="../variables/platform.tfvars")
  echo "📄 Using secrets from platform.tfvars"
else
  echo "⚠️  No platform.tfvars: relying on TF_VAR_* environment variables for secrets"
fi

echo "🚀 Platform infra deploy (local Terraform)"
echo "   Domain: $(read_tfvar domain_name "$VAR_FILE_COMMITTED")"
echo "   Backend image (baseline): $BACKEND_IMAGE"
echo ""

cd "$TF_DIR"

terraform init -reconfigure -backend-config="$BACKEND_CONFIG"
terraform validate

terraform plan \
  "${VAR_FILES[@]}" \
  -var="backend_image=${BACKEND_IMAGE}" \
  -var="worker_image=${WORKER_IMAGE}" \
  -out=tfplan

echo ""
echo "Plan summary:"
terraform show -json tfplan | jq -r '
  .resource_changes[]
  | select(.change.actions != ["no-op"])
  | "\(.change.actions[0]): \(.address)"
' | head -40

if [ "$PLAN_ONLY" = "plan-only" ]; then
  echo ""
  echo "Plan only: not applying."
  exit 0
fi

echo ""
read -r -p "Apply platform infrastructure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Cancelled."
  rm -f tfplan
  exit 0
fi

terraform apply tfplan
rm -f tfplan

ENABLE_COGNITO_MRR=$(grep -E '^enable_cognito_mrr[[:space:]]*=' "$VAR_FILE_COMMITTED" | head -1 | sed -E 's/^[^=]*=[[:space:]]*//' | tr '[:upper:]' '[:lower:]')
if [ "$ENABLE_COGNITO_MRR" = "true" ]; then
  echo ""
  echo "🔐 Syncing Cognito pool config..."
  "$REPO_ROOT/scripts/cognito-sync-pool-config.sh" platform
fi

echo ""
echo "✅ Platform infrastructure applied."
echo "Next: sync GitHub platform secrets, then run Deploy to Platform workflow (app only)."
echo "  ./scripts/sync-github-secrets-from-tfvars.sh platform"
echo "  ./scripts/verify-github-env-secrets.sh platform"
