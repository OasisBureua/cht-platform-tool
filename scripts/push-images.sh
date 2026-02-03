#!/bin/bash
set -e

VERSION=${1:-latest}
AWS_REGION=${2:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

ECR_BACKEND="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/cht-platform-backend"
ECR_WORKER="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/cht-platform-worker"

echo "🚀 Pushing Docker images to ECR"
echo "Version: $VERSION"
echo "Region: $AWS_REGION"
echo ""

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
echo "✅ Logged in"
echo ""

# Tag and push Backend
echo "📤 Pushing backend image..."
docker tag cht-platform-backend:$VERSION $ECR_BACKEND:$VERSION
docker tag cht-platform-backend:$VERSION $ECR_BACKEND:latest
docker push $ECR_BACKEND:$VERSION
docker push $ECR_BACKEND:latest
echo "✅ Backend pushed"
echo ""

# Tag and push Worker
echo "📤 Pushing worker image..."
docker tag cht-platform-worker:$VERSION $ECR_WORKER:$VERSION
docker tag cht-platform-worker:$VERSION $ECR_WORKER:latest
docker push $ECR_WORKER:$VERSION
docker push $ECR_WORKER:latest
echo "✅ Worker pushed"
echo ""

echo "✅ All images pushed successfully!"
echo ""
echo "Backend: $ECR_BACKEND:$VERSION"
echo "Worker:  $ECR_WORKER:$VERSION"
echo ""
echo "Update your terraform.tfvars:"
echo "backend_image = \"$ECR_BACKEND:$VERSION\""
echo "worker_image  = \"$ECR_WORKER:$VERSION\""
