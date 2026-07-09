#!/usr/bin/env bash
# Point ECS services at new container images without Terraform.
# Usage:
#   ./scripts/ecs-update-service-images.sh <platform|dev> <image_tag>
#   BACKEND_IMAGE=... WORKER_IMAGE=... ./scripts/ecs-update-service-images.sh platform
set -euo pipefail

ENV="${1:-platform}"
IMAGE_TAG="${2:-}"

case "$ENV" in
  platform|prod) CLUSTER="cht-platform-cluster"; PREFIX="cht-platform" ;;
  dev) CLUSTER="cht-dev-cluster"; PREFIX="cht-dev" ;;
  *)
    echo "Unknown environment: $ENV (use platform or dev)" >&2
    exit 1
    ;;
esac

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REGISTRY="${ECR_REGISTRY:-233636046512.dkr.ecr.us-east-1.amazonaws.com}"

BACKEND_IMAGE="${BACKEND_IMAGE:-}"
WORKER_IMAGE="${WORKER_IMAGE:-}"
if [ -z "$BACKEND_IMAGE" ]; then
  BACKEND_IMAGE="${ECR_REGISTRY}/cht-platform-backend:${IMAGE_TAG}"
fi
if [ -z "$WORKER_IMAGE" ]; then
  WORKER_IMAGE="${ECR_REGISTRY}/cht-platform-worker:${IMAGE_TAG}"
fi
if [ -z "$IMAGE_TAG" ] && { [ -z "$BACKEND_IMAGE" ] || [ -z "$WORKER_IMAGE" ]; }; then
  echo "Usage: $0 <platform|dev> <image_tag>" >&2
  echo "   or set BACKEND_IMAGE and WORKER_IMAGE" >&2
  exit 1
fi

update_service() {
  local service=$1
  local container=$2
  local image=$3
  local task_def task_def_arn new_task_def

  task_def_arn=$(aws ecs describe-services \
    --cluster "$CLUSTER" \
    --services "$service" \
    --region "$AWS_REGION" \
    --query 'services[0].taskDefinition' \
    --output text)

  aws ecs describe-task-definition \
    --task-definition "$task_def_arn" \
    --region "$AWS_REGION" \
    --query 'taskDefinition' > /tmp/ecs-task-def.json

  jq --arg IMAGE "$image" --arg CONTAINER "$container" \
    'del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)
     | .containerDefinitions = (.containerDefinitions | map(if .name == $CONTAINER then .image = $IMAGE else . end))' \
    /tmp/ecs-task-def.json > /tmp/ecs-task-def-new.json

  new_task_def=$(aws ecs register-task-definition \
    --cli-input-json file:///tmp/ecs-task-def-new.json \
    --region "$AWS_REGION" \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text)

  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$service" \
    --task-definition "$new_task_def" \
    --force-new-deployment \
    --region "$AWS_REGION" \
    --no-cli-pager \
    --output text \
    --query 'service.serviceName'

  echo "  $service → $image ($new_task_def)"
}

echo "Updating ECS images ($ENV)"
echo "  Backend: $BACKEND_IMAGE"
echo "  Worker:  $WORKER_IMAGE"
echo ""

update_service "${PREFIX}-backend" "backend" "$BACKEND_IMAGE"
update_service "${PREFIX}-worker" "worker" "$WORKER_IMAGE"

echo ""
echo "Waiting for services to stabilize..."
aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services "${PREFIX}-backend" "${PREFIX}-worker" \
  --region "$AWS_REGION"

echo "Done."
