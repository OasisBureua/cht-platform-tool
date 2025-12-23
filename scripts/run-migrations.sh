#!/bin/bash
set -e

echo "🗄️  CHT Platform - Run Database Migrations"
echo "=========================================="
echo ""

# Check environment
if [ -z "$1" ]; then
    echo "Usage: ./run-migrations.sh [dev|prod]"
    exit 1
fi

ENV=$1

echo "📦 Environment: $ENV"
echo ""

# Get cluster and task info
cd infrastructure/terraform/environments/us-east-1
CLUSTER=$(terraform output -raw cluster_name)
cd ../../../..

echo "🔍 Finding backend task..."
TASK_ARN=$(aws ecs list-tasks \
  --cluster $CLUSTER \
  --family cht-platform-${ENV}-backend \
  --region us-east-1 \
  --query 'taskArns[0]' \
  --output text)

if [ "$TASK_ARN" == "None" ] || [ -z "$TASK_ARN" ]; then
    echo "❌ No backend tasks found. Is the service running?"
    exit 1
fi

echo "📦 Task: $TASK_ARN"
echo ""

# Run migrations
echo "🚀 Running migrations..."
aws ecs execute-command \
  --cluster $CLUSTER \
  --task $TASK_ARN \
  --container backend \
  --region us-east-1 \
  --interactive \
  --command "npx prisma migrate deploy"

echo ""
echo "✅ Migrations completed!"