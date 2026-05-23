#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🗄️  CHT Platform - Run Database Migrations"
echo "=========================================="
echo ""

ENV=${1:-platform}
AWS_REGION=${AWS_REGION:-us-east-1}

case "$ENV" in
  platform)
    TF_DIR="infrastructure/terraform/environments/us-east-1"
    CLUSTER="cht-platform-cluster"
    SERVICE="cht-platform-backend"
    TASK_FAMILY="cht-platform-backend"
    ;;
  staging)
    TF_DIR="infrastructure/terraform/environments/us-east-1-staging"
    CLUSTER="cht-platform-staging-cluster"
    SERVICE="cht-platform-staging-backend"
    TASK_FAMILY="cht-platform-staging-backend"
    ;;
  dev)
    TF_DIR="infrastructure/terraform/environments/us-east-1"
    CLUSTER="cht-platform-dev-cluster"
    SERVICE="cht-platform-dev-backend"
    TASK_FAMILY="cht-platform-dev-backend"
    ;;
  prod)
    TF_DIR="infrastructure/terraform/environments/us-east-1"
    CLUSTER="cht-platform-prod-cluster"
    SERVICE="cht-platform-prod-backend"
    TASK_FAMILY="cht-platform-prod-backend"
    ;;
  *)
    echo "Usage: ./run-migrations.sh [platform|staging|dev|prod]"
    echo "  Default: platform"
    exit 1
    ;;
esac

if terraform -chdir="$TF_DIR" output -raw cluster_name &>/dev/null; then
  CLUSTER=$(terraform -chdir="$TF_DIR" output -raw cluster_name)
fi

echo "📦 Environment: $ENV"
echo "📍 Cluster: $CLUSTER"
echo "📍 Service: $SERVICE"
echo ""
echo "ℹ️  Migrations also run automatically on backend container startup."
echo ""

echo "🔍 Finding running backend tasks..."
TASK_ARNS=$(aws ecs list-tasks \
  --cluster "$CLUSTER" \
  --service-name "$SERVICE" \
  --desired-status RUNNING \
  --region "$AWS_REGION" \
  --query 'taskArns' \
  --output text)

if [ -z "$TASK_ARNS" ] || [ "$TASK_ARNS" == "None" ]; then
  echo "❌ No running backend tasks found. Is the service up?"
  exit 1
fi

run_migration_on_task() {
  local TASK_ARN=$1
  echo "📦 Task: $TASK_ARN"
  echo "🚀 Running migrations..."
  aws ecs execute-command \
    --cluster "$CLUSTER" \
    --task "$TASK_ARN" \
    --container backend \
    --region "$AWS_REGION" \
    --interactive \
    --command "npx prisma migrate deploy"
}

EXEC_FAILED=0
for TASK_ARN in $TASK_ARNS; do
  if run_migration_on_task "$TASK_ARN"; then
    echo ""
    echo "✅ Migrations completed!"
    exit 0
  fi
  EXEC_FAILED=1
  echo "⚠️  Exec failed on this task, trying next if available..."
  echo ""
done

if [ "$EXEC_FAILED" -eq 1 ]; then
  echo "❌ ECS Exec failed (TargetNotConnected)."
  echo ""
  echo "Common fixes:"
  echo "  1. Ensure the ECS task role allows SSM channels (terraform module security/iam ecs_task_exec policy)"
  echo "  2. Apply Terraform, then redeploy backend:"
  echo "       aws ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment --region $AWS_REGION"
  echo "  3. Or rely on startup migrations (backend Dockerfile runs 'prisma migrate deploy' on boot)"
  echo ""
  echo "Check exec agent status:"
  echo "  aws ecs describe-tasks --cluster $CLUSTER --tasks <task-id> --query 'tasks[].containers[].managedAgents'"
  exit 1
fi
