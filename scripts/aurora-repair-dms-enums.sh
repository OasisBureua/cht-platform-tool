#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SQL_FILE="$SCRIPT_DIR/aurora-repair-dms-enums.sql"
ENV=${1:-platform}
AWS_REGION=${AWS_REGION:-us-east-1}

case "$ENV" in
  platform)
    CLUSTER="cht-platform-cluster"
    SERVICE="cht-platform-backend"
    ;;
  dev)
    CLUSTER="cht-dev-cluster"
    SERVICE="cht-dev-backend"
    ;;
  *)
    echo "Usage: ./aurora-repair-dms-enums.sh [platform|dev]"
    exit 1
    ;;
esac

if [ ! -f "$SQL_FILE" ]; then
  echo "❌ Missing $SQL_FILE"
  exit 1
fi

echo "🔧 Aurora DMS enum repair ($ENV)"
echo "================================"
echo ""
echo "Step 1: Create missing PostgreSQL ENUM types"
echo "Step 2: Convert DMS varchar columns to those enum types"
echo ""

TASK_ARN=$(aws ecs list-tasks \
  --cluster "$CLUSTER" \
  --service-name "$SERVICE" \
  --desired-status RUNNING \
  --region "$AWS_REGION" \
  --query 'taskArns[0]' \
  --output text)

if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
  echo "❌ No running backend task in $CLUSTER / $SERVICE"
  exit 1
fi

echo "📦 Task: $TASK_ARN"
echo "🚀 Step 1/2: enum types..."
echo ""

SQL_B64=$(base64 < "$SQL_FILE" | tr -d '\n')

aws ecs execute-command \
  --cluster "$CLUSTER" \
  --task "$TASK_ARN" \
  --container backend \
  --region "$AWS_REGION" \
  --interactive \
  --command "sh -c 'echo ${SQL_B64} | base64 -d | npx prisma db execute --stdin'"

COL_FILE="$SCRIPT_DIR/aurora-repair-dms-enum-columns.sql"
if [ ! -f "$COL_FILE" ]; then
  echo "❌ Missing $COL_FILE"
  exit 1
fi

echo ""
echo "🚀 Step 2/2: enum column types..."
COL_B64=$(base64 < "$COL_FILE" | tr -d '\n')

aws ecs execute-command \
  --cluster "$CLUSTER" \
  --task "$TASK_ARN" \
  --container backend \
  --region "$AWS_REGION" \
  --interactive \
  --command "sh -c 'echo ${COL_B64} | base64 -d | npx prisma db execute --stdin'"

echo ""
echo "✅ DMS schema repair complete (enum types + column casts)."
echo "   Refresh admin dashboard — user counts and payments should load."
