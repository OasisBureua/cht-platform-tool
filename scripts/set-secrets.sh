#!/bin/bash
set -e

# Update Secrets Manager with current values from Terraform (RDS, Redis, app secrets)
# Usage: ./set-secrets.sh [platform|dev|prod]
#
# Run after terraform apply to refresh secret values, or when secrets are out of sync.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

ENV=${1:-platform}
AWS_REGION=${AWS_REGION:-us-east-1}

echo "🔐 CHT Platform - Set Secret Values"
echo "==================================="
echo ""
echo "Environment: $ENV"
echo "Region: $AWS_REGION"
echo ""

VAR_FILE="infrastructure/terraform/environments/variables/${ENV}.tfvars"
if [ ! -f "$VAR_FILE" ]; then
  if [ -f "${VAR_FILE}.example" ]; then
    echo "⚠️  $VAR_FILE not found. Copy from example and fill in secrets:"
    echo "   cp ${VAR_FILE}.example $VAR_FILE"
  else
    echo "❌ $VAR_FILE not found."
  fi
  exit 1
fi

cd infrastructure/terraform/environments/us-east-1

echo "🔄 Updating Secrets Manager with Terraform values..."
terraform apply \
  -var-file="../variables/${ENV}.tfvars" \
  -target=module.secrets \
  -auto-approve

cd "$PROJECT_ROOT"
echo ""
echo "✅ Secrets updated successfully."
