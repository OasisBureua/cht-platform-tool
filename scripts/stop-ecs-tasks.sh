#!/bin/bash
set -e

# Scale ECS services to 0 and wait for all tasks to stop
# Usage: ./stop-ecs-tasks.sh [platform|dev|prod]
#
# Run before deploy when you want a clean slate. Then run deploy-ecs-services.sh
# which will scale back up and start new tasks.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

ENV=${1:-platform}
AWS_REGION=${AWS_REGION:-us-east-1}

CLUSTER_NAME="cht-platform-cluster"
BACKEND_SERVICE="cht-platform-backend"
WORKER_SERVICE="cht-platform-worker"

# Desired counts from platform.tfvars (to restore later)
BACKEND_DESIRED=2
WORKER_DESIRED=1
if [ "$ENV" = "dev" ]; then
  BACKEND_DESIRED=1
  WORKER_DESIRED=1
fi

echo "🛑 CHT Platform - Stop All ECS Tasks"
echo "====================================="
echo ""
echo "Environment: $ENV"
echo "Cluster: $CLUSTER_NAME"
echo "Region: $AWS_REGION"
echo ""

echo "📉 Scaling services to 0..."
aws ecs update-service --cluster "$CLUSTER_NAME" --service "$BACKEND_SERVICE" --desired-count 0 --region "$AWS_REGION" --no-cli-pager --output text --query 'service.serviceName'
aws ecs update-service --cluster "$CLUSTER_NAME" --service "$WORKER_SERVICE" --desired-count 0 --region "$AWS_REGION" --no-cli-pager --output text --query 'service.serviceName'
echo ""

echo "⏳ Waiting for all tasks to stop (this may take a few minutes)..."
for i in $(seq 1 30); do
  RUNNING=$(aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$BACKEND_SERVICE" "$WORKER_SERVICE" --region "$AWS_REGION" --query 'sum(services[*].runningCount)' --output text 2>/dev/null || echo "1")
  if [ "${RUNNING:-1}" = "0" ]; then
    echo "✅ All tasks stopped."
    break
  fi
  echo "   Waiting... (running: $RUNNING)"
  sleep 10
done

echo ""
echo "✅ Services scaled to 0. Run ./scripts/deploy-ecs-services.sh $ENV <version> to deploy."
