#!/bin/bash
set -e

echo "🎨 CHT Platform - Deploy Frontend"
echo "================================="
echo ""

if [ -z "$1" ]; then
    echo "Usage: ./deploy-frontend.sh [platform|dev] [both]"
    echo ""
    echo "  platform       testapp.communityhealth.media  (platform.tfvars)"
    echo "  dev            devapp.communityhealth.media    (dev.tfvars)"
    echo "  both (optional) also sync build to us-east-2 DR S3 bucket"
    exit 1
fi

ENV=$1
SYNC_SECONDARY=false
if [ "${2:-}" = "both" ]; then
  SYNC_SECONDARY=true
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PRIMARY_TF_DIR="$REPO_ROOT/infrastructure/terraform/environments/us-east-1"
SECONDARY_TF_DIR="$REPO_ROOT/infrastructure/terraform/environments/us-east-2"
BACKENDS_DIR="$REPO_ROOT/infrastructure/terraform/environments/backends"
VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/${ENV}.tfvars"
AWS_REGION="${AWS_REGION:-us-east-1}"

case "$ENV" in
  platform|dev) ;;
  prod)
    echo "ℹ️  'prod' is an alias for platform (testapp.communityhealth.media)"
    ENV=platform
    VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/platform.tfvars"
    ;;
  *)
    echo "❌ Unknown environment: $1 (use platform or dev)"
    exit 1
    ;;
esac

if [ ! -f "$VAR_FILE" ]; then
  echo "❌ Variable file not found: $VAR_FILE"
  exit 1
fi

DOMAIN=$(grep -E '^domain_name[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')
PROJECT=$(grep -E '^project[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')
TF_ENVIRONMENT=$(grep -E '^environment[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')
RECAPTCHA_SITE_KEY=$(grep -E '^recaptcha_site_key[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/' || true)
GOOGLE_CLIENT_ID=$(grep -E '^cognito_google_client_id[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/' || true)

if [ -z "$DOMAIN" ]; then
  echo "❌ Could not read domain_name from $VAR_FILE"
  exit 1
fi
if [ -z "$PROJECT" ] || [ -z "$TF_ENVIRONMENT" ]; then
  echo "❌ Could not read project/environment from $VAR_FILE"
  exit 1
fi

API_URL="https://${DOMAIN}/api"
APP_URL="https://${DOMAIN}"

# Match Terraform resource prefix (modules use project, or project-environment when not platform)
if [ "$TF_ENVIRONMENT" = "platform" ]; then
  RESOURCE_PREFIX="$PROJECT"
  DR_RESOURCE_PREFIX="${PROJECT}-dr-use2"
else
  RESOURCE_PREFIX="${PROJECT}-${TF_ENVIRONMENT}"
  DR_RESOURCE_PREFIX="${PROJECT}-dr-use2-${TF_ENVIRONMENT}"
fi

EXPECTED_BUCKET="${RESOURCE_PREFIX}-frontend"
EXPECTED_DR_BUCKET="${DR_RESOURCE_PREFIX}-frontend"

case "$ENV" in
  platform)
    PRIMARY_BACKEND_CONFIG="$BACKENDS_DIR/us-east-1-platform.hcl"
    SECONDARY_BACKEND_CONFIG="$BACKENDS_DIR/us-east-2-platform.hcl"
    ;;
  dev)
    PRIMARY_BACKEND_CONFIG="$BACKENDS_DIR/us-east-1-dev.hcl"
    SECONDARY_BACKEND_CONFIG="$BACKENDS_DIR/us-east-2-dev.hcl"
    ;;
esac

echo "📦 Environment: $ENV"
echo "📄 Variables:  $(basename "$VAR_FILE")"
echo "🌐 Domain:      $DOMAIN"
echo "🪣 Primary S3:  $EXPECTED_BUCKET"
if [ "$SYNC_SECONDARY" = true ]; then
  echo "🪣 DR S3:       $EXPECTED_DR_BUCKET (us-east-2)"
fi
echo ""

cd "$PRIMARY_TF_DIR"
echo "🔧 Reading primary Terraform outputs..."
terraform init -input=false -reconfigure -backend-config="$PRIMARY_BACKEND_CONFIG" >/dev/null

BUCKET=$(terraform output -raw frontend_bucket)
DIST_ID=$(terraform output -raw cloudfront_distribution_id)
TF_API_URL=$(terraform output -raw api_url 2>/dev/null || true)
COGNITO_USER_POOL_ID=$(terraform output -raw cognito_user_pool_id 2>/dev/null || true)
COGNITO_CLIENT_ID=$(terraform output -raw cognito_client_id 2>/dev/null || true)
COGNITO_HOSTED_UI=$(terraform output -raw cognito_hosted_ui_base_url 2>/dev/null || true)
cd "$REPO_ROOT"

if [ "$BUCKET" != "$EXPECTED_BUCKET" ]; then
  echo "❌ S3 bucket mismatch for $ENV."
  echo "   Expected: $EXPECTED_BUCKET"
  echo "   State has: $BUCKET"
  echo "   Run: ./scripts/deploy-primary.sh $ENV"
  exit 1
fi

if [ -n "$TF_API_URL" ] && [ "$TF_API_URL" != "$API_URL" ]; then
  echo "❌ Terraform state domain does not match ${ENV}.tfvars."
  echo "   tfvars:  $API_URL"
  echo "   state:   $TF_API_URL"
  echo "   Run: ./scripts/deploy-primary.sh $ENV"
  exit 1
fi

if [ -z "$COGNITO_USER_POOL_ID" ] || [ -z "$COGNITO_CLIENT_ID" ] || [ -z "$COGNITO_HOSTED_UI" ]; then
  echo "❌ Cognito outputs missing. Set enable_cognito_pools = true and apply ${ENV}.tfvars first."
  exit 1
fi

DR_BUCKET=""
if [ "$SYNC_SECONDARY" = true ]; then
  cd "$SECONDARY_TF_DIR"
  terraform init -input=false -reconfigure -backend-config="$SECONDARY_BACKEND_CONFIG" >/dev/null
  DR_BUCKET=$(terraform output -raw frontend_bucket 2>/dev/null || true)
  cd "$REPO_ROOT"

  if [ -z "$DR_BUCKET" ]; then
    echo "❌ DR frontend bucket not found in us-east-2 state."
    echo "   Run: ./scripts/deploy-secondary.sh $ENV"
    exit 1
  fi

  if [ "$DR_BUCKET" != "$EXPECTED_DR_BUCKET" ]; then
    echo "❌ DR S3 bucket mismatch for $ENV."
    echo "   Expected: $EXPECTED_DR_BUCKET"
    echo "   State has: $DR_BUCKET"
    exit 1
  fi
fi

echo "☁️  CloudFront: $DIST_ID"
echo "📡 API URL:    $API_URL"
echo "🌐 App URL:    $APP_URL"
echo "🔐 Cognito:    $COGNITO_HOSTED_UI"
echo ""

case "$ENV" in
  dev)
    VITE_BUILD_MODE=development
    VITE_ENV_FILE=.env.development
    ;;
  platform)
    VITE_BUILD_MODE=production
    VITE_ENV_FILE=.env.production
    ;;
  *)
    echo "❌ Unknown environment for frontend build: $ENV"
    exit 1
    ;;
esac

echo "🔨 Building frontend (mode: $VITE_BUILD_MODE)..."
cd "$REPO_ROOT/frontend"

build_env_file() {
  echo "VITE_API_URL=$API_URL"
  echo "VITE_APP_URL=$APP_URL"
  echo "VITE_COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID"
  echo "VITE_COGNITO_CLIENT_ID=$COGNITO_CLIENT_ID"
  echo "VITE_COGNITO_DOMAIN=$COGNITO_HOSTED_UI"
  echo "VITE_COGNITO_REGION=$AWS_REGION"
  echo "VITE_MEDIAHUB_AUTH_DECOMMISSIONED=true"
  echo "VITE_DISABLE_AUTH=false"
  echo "VITE_USE_DEV_AUTH=false"
  if [ -n "$RECAPTCHA_SITE_KEY" ]; then
    echo "VITE_RECAPTCHA_SITE_KEY=$RECAPTCHA_SITE_KEY"
  fi
  if [ -n "$GOOGLE_CLIENT_ID" ]; then
    echo "VITE_GOOGLE_OAUTH_ENABLED=true"
  fi
}
build_env_file > "$VITE_ENV_FILE"

npx update-browserslist-db@latest --update-db 2>/dev/null || true

npm run build -- --mode "$VITE_BUILD_MODE"

echo ""
echo "📤 Uploading to primary S3 ($BUCKET)..."
aws s3 sync dist/ "s3://${BUCKET}/" --delete

if [ "$SYNC_SECONDARY" = true ]; then
  echo ""
  echo "📤 Uploading to DR S3 ($DR_BUCKET, us-east-2)..."
  aws s3 sync dist/ "s3://${DR_BUCKET}/" --delete
fi

echo ""
echo "🔄 Invalidating CloudFront cache..."
aws cloudfront create-invalidation \
  --distribution-id "$DIST_ID" \
  --paths "/*"

cd "$REPO_ROOT"

echo ""
echo "✅ Frontend deployed successfully!"
echo ""
echo "🌐 App URL:  $APP_URL"
echo "📡 API URL:  $API_URL"
if [ "$SYNC_SECONDARY" = true ]; then
  echo "🪣 DR bucket: s3://${DR_BUCKET}/"
fi
