#!/bin/bash
set -e

# Update Secrets Manager with current values from Terraform (RDS, Redis, app secrets)
# Usage: ./set-secrets.sh [platform|dev|prod] [--no-restart]
#
# Run after terraform apply to refresh secret values, or when secrets are out of sync.
# By default, forces ECS backend (and worker) to redeploy so running tasks pick up new secrets.
# Use --no-restart to skip the ECS restart.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

NO_RESTART=""
ENV="platform"
for arg in "$@"; do
  if [[ "$arg" == "--no-restart" ]]; then
    NO_RESTART=1
  else
    ENV="$arg"
  fi
done
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
echo "✅ Secrets updated in Secrets Manager."

if [ -z "$NO_RESTART" ]; then
  CLUSTER_NAME="cht-platform-cluster"
  BACKEND_SERVICE="cht-platform-backend"
  WORKER_SERVICE="cht-platform-worker"
  BACKEND_DESIRED=$(grep "backend_desired_count" "$VAR_FILE" 2>/dev/null | sed 's/.*= *\([0-9]*\).*/\1/' || echo "2")
  WORKER_DESIRED=$(grep "worker_desired_count" "$VAR_FILE" 2>/dev/null | sed 's/.*= *\([0-9]*\).*/\1/' || echo "1")

  echo ""
  echo "🔄 Forcing ECS services to redeploy (tasks read secrets at startup)..."
  aws ecs update-service --cluster "$CLUSTER_NAME" --service "$BACKEND_SERVICE" --desired-count "$BACKEND_DESIRED" --force-new-deployment --region "$AWS_REGION" --no-cli-pager --output text --query 'service.serviceName'
  aws ecs update-service --cluster "$CLUSTER_NAME" --service "$WORKER_SERVICE" --desired-count "$WORKER_DESIRED" --force-new-deployment --region "$AWS_REGION" --no-cli-pager --output text --query 'service.serviceName'
  echo ""
  echo "⏳ Waiting for services to stabilize..."
  aws ecs wait services-stable --cluster "$CLUSTER_NAME" --services "$BACKEND_SERVICE" "$WORKER_SERVICE" --region "$AWS_REGION"
  echo ""
  echo "✅ ECS services restarted with new secrets."
fi

echo ""
echo "✅ Done."
