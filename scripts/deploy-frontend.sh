#!/bin/bash
set -e

echo "🎨 CHT Platform - Deploy Frontend"
echo "================================="
echo ""

if [ -z "$1" ]; then
    echo "Usage: ./deploy-frontend.sh [platform|staging|dev|prod]"
    exit 1
fi

ENV=$1
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "📦 Environment: $ENV"
echo ""

case "$ENV" in
  platform)
    API_URL="https://testapp.communityhealth.media/api"
    APP_URL="https://testapp.communityhealth.media"
    TF_DIR="infrastructure/terraform/environments/us-east-1"
    SECRET_ID="cht-platform-app-secrets"
    ;;
  staging)
    API_URL="https://staging.testapp.communityhealth.media/api"
    APP_URL="https://staging.testapp.communityhealth.media"
    TF_DIR="infrastructure/terraform/environments/us-east-1-staging"
    SECRET_ID="cht-platform-staging-app-secrets"
    ;;
  dev)
    API_URL="https://testapp.communityhealth.media/api"
    APP_URL="https://testapp.communityhealth.media"
    TF_DIR="infrastructure/terraform/environments/us-east-1"
    SECRET_ID="cht-platform-dev-app-secrets"
    ;;
  prod)
    API_URL="https://testapp.communityhealth.media/api"
    APP_URL="https://testapp.communityhealth.media"
    TF_DIR="infrastructure/terraform/environments/us-east-1"
    SECRET_ID="cht-platform-prod-app-secrets"
    ;;
  *)
    echo "❌ Unknown environment: $ENV (use platform, staging, dev, or prod)"
    exit 1
    ;;
esac

cd "$TF_DIR"
BUCKET=$(terraform output -raw frontend_bucket)
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
cd "$REPO_ROOT"

echo "🪣 S3 Bucket: $BUCKET"
echo "☁️  CloudFront: $DIST_ID"
echo "📡 API URL: $API_URL"
echo "🌐 App URL: $APP_URL"
echo ""

echo "🔨 Building frontend..."
cd "$REPO_ROOT/frontend"

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

build_env_file() {
  echo "VITE_API_URL=$API_URL"
  echo "VITE_SUPABASE_URL=$SUPABASE_URL"
  echo "VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
  echo "VITE_APP_URL=$APP_URL"
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

cd "$REPO_ROOT"

echo ""
echo "✅ Frontend deployed successfully!"
echo ""
echo "🌐 App URL:  $APP_URL"
echo "📡 API URL:  $API_URL"
