#!/bin/bash
set -e

echo "🎨 CHT Platform - Deploy Frontend"
echo "================================="
echo ""

# Check environment
if [ -z "$1" ]; then
    echo "Usage: ./deploy-frontend.sh [platform|dev|prod]"
    exit 1
fi

ENV=$1

echo "📦 Environment: $ENV"
echo ""

# API base URL: platform uses single domain testapp.communityhealth.media
if [ "$ENV" == "platform" ]; then
    API_URL="https://testapp.communityhealth.media/api"
else
    API_URL="https://api.communityhealth.media/api"
fi

# Get bucket name from terraform
cd infrastructure/terraform/environments/us-east-1
BUCKET=$(terraform output -raw frontend_bucket)
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
cd ../../../..

echo "🪣 S3 Bucket: $BUCKET"
echo "☁️  CloudFront: $DIST_ID"
echo "📡 API URL: $API_URL"
echo ""

# Build frontend
echo "🔨 Building frontend..."
cd frontend

# Pull Supabase vars from Secrets Manager (cht-platform-{env}-app-secrets)
SECRET_ID=$([ "$ENV" == "platform" ] && echo "cht-platform-app-secrets" || echo "cht-platform-${ENV}-app-secrets")
echo "📥 Fetching Supabase config from Secrets Manager ($SECRET_ID)..."
SECRET_JSON=$(aws secretsmanager get-secret-value --secret-id "$SECRET_ID" --query SecretString --output text 2>/dev/null || true)
if [ -n "$SECRET_JSON" ]; then
  SUPABASE_URL=$(echo "$SECRET_JSON" | jq -r '.supabase_url // empty')
  SUPABASE_ANON_KEY=$(echo "$SECRET_JSON" | jq -r '.supabase_anon_key // empty')
fi
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "⚠️  Could not load supabase_url/supabase_anon_key from Secrets Manager. Ensure $SECRET_ID exists and has been applied."
  exit 1
fi

# Production build: always use .env.production (Vite loads it for npm run build)
build_env_file() {
  echo "VITE_API_URL=$API_URL"
  echo "VITE_SUPABASE_URL=$SUPABASE_URL"
  echo "VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
  echo "VITE_DISABLE_AUTH=false"
  echo "VITE_USE_DEV_AUTH=false"
}
build_env_file > .env.production

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
if [ "$ENV" == "platform" ]; then
    echo "🌐 Test: open https://testapp.communityhealth.media"
else
    echo "🌐 Test: open https://app.communityhealth.media"
fi