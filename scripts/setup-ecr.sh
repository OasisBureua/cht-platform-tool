#!/bin/bash
set -e

AWS_REGION=${1:-us-east-1}
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "🐳 Setting up ECR repositories"
echo "Region: $AWS_REGION"
echo "Account ID: $AWS_ACCOUNT_ID"
echo ""

# Create Backend Repository
echo "📦 Creating backend repository..."
aws ecr create-repository \
  --repository-name cht-platform-backend \
  --region $AWS_REGION \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=KMS \
  --tags Key=Project,Value=cht-platform Key=Service,Value=backend \
  2>/dev/null || echo "Backend repository already exists"

# Create Worker Repository
echo "📦 Creating worker repository..."
aws ecr create-repository \
  --repository-name cht-platform-worker \
  --region $AWS_REGION \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=KMS \
  --tags Key=Project,Value=cht-platform Key=Service,Value=worker \
  2>/dev/null || echo "Worker repository already exists"

# Set lifecycle policies to clean up old images
echo "🗑️  Setting lifecycle policies..."

cat > /tmp/ecr-lifecycle-policy.json << 'POLICY'
{
  "rules": [
    {
      "rulePriority": 1,
      "description": "Keep last 10 images",
      "selection": {
        "tagStatus": "any",
        "countType": "imageCountMoreThan",
        "countNumber": 10
      },
      "action": {
        "type": "expire"
      }
    }
  ]
}
POLICY

aws ecr put-lifecycle-policy \
  --repository-name cht-platform-backend \
  --lifecycle-policy-text file:///tmp/ecr-lifecycle-policy.json \
  --region $AWS_REGION

aws ecr put-lifecycle-policy \
  --repository-name cht-platform-worker \
  --lifecycle-policy-text file:///tmp/ecr-lifecycle-policy.json \
  --region $AWS_REGION

rm /tmp/ecr-lifecycle-policy.json

echo ""
echo "✅ ECR repositories created!"
echo ""
echo "Backend:  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/cht-platform-backend"
echo "Worker:   $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/cht-platform-worker"
echo ""
echo "Next steps:"
echo "1. Build Docker images: ./scripts/build-images.sh"
echo "2. Push to ECR: ./scripts/push-images.sh"
