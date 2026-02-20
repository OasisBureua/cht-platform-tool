#!/bin/bash
set -e

# Deploy updated backend and worker to ECS
# Usage: ./deploy-ecs-services.sh [platform|dev|prod] [version] [--stop-first]
#
# --stop-first: Scale services to 0, wait for tasks to stop, then deploy
# If version differs from platform.tfvars, run terraform apply first.
# Then builds, pushes to ECR, and forces ECS to pull new images.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

STOP_FIRST=""
POSITIONAL=()
for arg in "$@"; do
  [[ "$arg" = "--stop-first" ]] && STOP_FIRST=1 || POSITIONAL+=("$arg")
done
ENV=${POSITIONAL[0]:-platform}
VERSION=${POSITIONAL[1]:-v1.0.0}
AWS_REGION=${AWS_REGION:-us-east-1}

echo "🚀 CHT Platform - Deploy Backend & Worker to ECS"
echo "================================================"
echo ""
echo "Environment: $ENV"
echo "Version: $VERSION"
echo "Region: $AWS_REGION"
echo ""

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_BACKEND="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/cht-platform-backend"
ECR_WORKER="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/cht-platform-worker"

CLUSTER_NAME="cht-platform-cluster"
BACKEND_SERVICE="cht-platform-backend"
WORKER_SERVICE="cht-platform-worker"

# Optional: stop all tasks first
if [ -n "$STOP_FIRST" ]; then
  echo "🛑 Stopping all tasks first..."
  "$SCRIPT_DIR/stop-ecs-tasks.sh" "$ENV"
  echo ""
fi

# Build
echo "📦 Building Docker images..."
"$SCRIPT_DIR/build-images.sh" "$VERSION"
echo ""

# Push to ECR
echo "📤 Pushing to ECR..."
"$SCRIPT_DIR/push-images.sh" "$VERSION" "$AWS_REGION"
echo ""

# Paths
VAR_FILE="infrastructure/terraform/environments/variables/${ENV}.tfvars"

# Update tfvars if version changed (optional - for new tags)
if [ ! -f "$VAR_FILE" ] && [ -f "${VAR_FILE}.example" ]; then
  echo "⚠️  $VAR_FILE not found. Copy from example and fill in secrets:"
  echo "   cp ${VAR_FILE}.example $VAR_FILE"
  exit 1
fi
# Ensure tfvars has the version we're deploying
CURRENT_BACKEND=$(grep "backend_image" "$VAR_FILE" 2>/dev/null | sed 's/.*= *"\([^"]*\)".*/\1/' || true)
NEW_BACKEND="${ECR_BACKEND}:${VERSION}"
if [ -n "$CURRENT_BACKEND" ] && [ "$CURRENT_BACKEND" != "$NEW_BACKEND" ]; then
  echo "🔄 Updating $VAR_FILE with new image tags..."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|backend_image = .*|backend_image = \"${ECR_BACKEND}:${VERSION}\"|" "$VAR_FILE"
    sed -i '' "s|worker_image = .*|worker_image  = \"${ECR_WORKER}:${VERSION}\"|" "$VAR_FILE"
  else
    sed -i "s|backend_image = .*|backend_image = \"${ECR_BACKEND}:${VERSION}\"|" "$VAR_FILE"
    sed -i "s|worker_image = .*|worker_image  = \"${ECR_WORKER}:${VERSION}\"|" "$VAR_FILE"
  fi
fi

# Always run Terraform apply so ECS task definition gets the correct image
echo "🔄 Applying Terraform (ECS task definition)..."
cd infrastructure/terraform/environments/us-east-1
terraform apply -var-file="../variables/${ENV}.tfvars" -auto-approve -target=module.ecs_backend -target=module.ecs_worker
cd "$PROJECT_ROOT"
echo ""

# Force ECS to pull new images and redeploy (restore desired count if was 0)
BACKEND_DESIRED=$(grep "backend_desired_count" "$VAR_FILE" 2>/dev/null | sed 's/.*= *\([0-9]*\).*/\1/' || echo "2")
WORKER_DESIRED=$(grep "worker_desired_count" "$VAR_FILE" 2>/dev/null | sed 's/.*= *\([0-9]*\).*/\1/' || echo "1")

echo "🔄 Forcing ECS service updates (desired: backend=$BACKEND_DESIRED, worker=$WORKER_DESIRED)..."
aws ecs update-service --cluster "$CLUSTER_NAME" --service "$BACKEND_SERVICE" --desired-count "$BACKEND_DESIRED" --force-new-deployment --region "$AWS_REGION" --no-cli-pager --output text --query 'service.serviceName'
aws ecs update-service --cluster "$CLUSTER_NAME" --service "$WORKER_SERVICE" --desired-count "$WORKER_DESIRED" --force-new-deployment --region "$AWS_REGION" --no-cli-pager --output text --query 'service.serviceName'
echo ""

echo "⏳ Waiting for services to stabilize (this may take a few minutes)..."
aws ecs wait services-stable --cluster "$CLUSTER_NAME" --services "$BACKEND_SERVICE" "$WORKER_SERVICE" --region "$AWS_REGION"
echo ""

echo "✅ Backend and Worker deployed successfully!"
echo ""
echo "🧪 Test: curl https://testapp.communityhealth.media/health/ready"
