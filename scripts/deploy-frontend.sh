#!/bin/bash
set -e

echo "🎨 CHT Platform - Deploy Frontend"
echo "================================="
echo ""

# Check environment
if [ -z "$1" ]; then
    echo "Usage: ./deploy-frontend.sh [dev|prod]"
    exit 1
fi

ENV=$1

echo "📦 Environment: $ENV"
echo ""

# Get bucket name from terraform
cd infrastructure/terraform/environments/us-east-1
BUCKET=$(terraform output -raw frontend_bucket)
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
cd ../../../..

echo "🪣 S3 Bucket: $BUCKET"
echo "☁️  CloudFront: $DIST_ID"
echo ""

# Build frontend
echo "🔨 Building frontend..."
cd frontend

# Set environment
if [ "$ENV" == "prod" ]; then
    echo "VITE_API_URL=https://api.communityhealth.media/api" > .env.production
else
    echo "VITE_API_URL=https://api.communityhealth.media/api" > .env.development
fi

npm run build

echo ""
echo "📤 Uploading to S3..."
aws s3 sync dist/ s3://$BUCKET/ --delete

echo ""
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id $DIST_ID \
  --paths "/*"

cd ..

echo ""
echo "✅ Frontend deployed successfully!"
echo ""
echo "🌐 Test: open https://app.communityhealth.media"