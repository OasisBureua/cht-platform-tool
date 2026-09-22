#!/usr/bin/env bash
# Verify GitHub Environment secrets via gh CLI (local pre-deploy check).
# Usage: ./scripts/verify-github-secrets.sh [staging|platform|production|development]
set -euo pipefail

RAW_ENV="${1:-staging}"
case "$RAW_ENV" in
  production|platform) GH_ENV="platform" ;;
  staging|development) GH_ENV="$RAW_ENV" ;;
  *)
    echo "Unknown environment: $RAW_ENV (use staging, platform, production, or development)"
    exit 1
    ;;
esac

echo "🔍 Verifying GitHub Environment: $GH_ENV"
echo "======================================"
echo ""

if ! command -v gh &>/dev/null; then
  echo "❌ GitHub CLI not installed (brew install gh && gh auth login)"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "❌ Not authenticated with GitHub (gh auth login)"
  exit 1
fi

echo "✅ GitHub CLI authenticated"
echo ""

if ! gh api "repos/{owner}/{repo}/environments/$GH_ENV" &>/dev/null; then
  echo "❌ GitHub environment '$GH_ENV' not found"
  echo "   Create: Settings → Environments → New environment → $GH_ENV"
  exit 1
fi

ENV_SECRETS=$(gh secret list --env "$GH_ENV" 2>/dev/null || true)

has_secret() {
  echo "$ENV_SECRETS" | grep -qE "^${1}[[:space:]]"
}

REQUIRED_SECRETS=(
  "AWS_ROLE_ARN"
  "ACM_CERTIFICATE_ARN"
  "CLOUDFRONT_CERTIFICATE_ARN"
  "YOUTUBE_API_KEY"
  "YOUTUBE_PLAYLIST_IDS"
  "ZOOM_ACCOUNT_ID"
  "ZOOM_CLIENT_ID"
  "ZOOM_CLIENT_SECRET"
  "ZOOM_WEBHOOK_SECRET"
  "ZOOM_SDK_KEY"
  "ZOOM_SDK_SECRET"
  "JOTFORM_API_KEY"
  "BILL_DEV_KEY"
  "BILL_USERNAME"
  "BILL_PASSWORD"
  "BILL_ORG_ID"
  "BILL_FUNDING_ACCOUNT_ID"
  "COGNITO_GOOGLE_CLIENT_ID"
  "COGNITO_GOOGLE_CLIENT_SECRET"
  "RECAPTCHA_SITE_KEY"
  "RECAPTCHA_SECRET_KEY"
  "CONTENTHUB_API_KEY"
  "INTERNAL_CACHE_SECRET"
  "HUBSPOT_ACCESS_TOKEN"
)

OPTIONAL_SECRETS=(
  "BILL_WEBHOOK_SECRET"
  "BILL_MFA_REMEMBER_ME_ID"
  "BILL_MFA_DEVICE_NAME"
  "ADMIN_BOOTSTRAP_SECRET"
)

echo "📋 $GH_ENV environment secrets:"
echo ""
echo "Required:"
MISSING=0
for secret in "${REQUIRED_SECRETS[@]}"; do
  if has_secret "$secret"; then
    echo "  ✅ $secret"
  else
    echo "  ❌ $secret (MISSING)"
    MISSING=1
  fi
done

echo ""
echo "Optional:"
for secret in "${OPTIONAL_SECRETS[@]}"; do
  if has_secret "$secret"; then
    echo "  ✅ $secret"
  else
    echo "  ⏳ $secret (not set)"
  fi
done

echo ""
echo "================================================"
echo ""

if [ "$GH_ENV" = "staging" ] || [ "$GH_ENV" = "platform" ]; then
  CERT_ARN=""
  CERT_FILE="infrastructure/terraform/environments/variables/.cert-arns-testapp"
  if [ -f "$CERT_FILE" ]; then
    # shellcheck source=/dev/null
    source "$CERT_FILE"
    CERT_ARN="${certificate_arn:-${us_east_1_cert_arn:-}}"
  fi

  echo "📜 SSL certificate status:"
  if [ -n "$CERT_ARN" ]; then
    CERT_STATUS=$(aws acm describe-certificate \
      --certificate-arn "$CERT_ARN" \
      --region us-east-1 \
      --query 'Certificate.Status' \
      --output text 2>/dev/null || echo "ERROR")

    if [ "$CERT_STATUS" = "ISSUED" ]; then
      echo "  ✅ Certificate ISSUED"
      for cert_secret in ACM_CERTIFICATE_ARN CLOUDFRONT_CERTIFICATE_ARN; do
        if has_secret "$cert_secret"; then
          echo "  ✅ $cert_secret set in GitHub"
        else
          echo "  ⚠️  $cert_secret not in GitHub"
          echo "     gh secret set $cert_secret --env $GH_ENV --body \"$CERT_ARN\""
          MISSING=1
        fi
      done
    else
      echo "  ⏳ Certificate status: $CERT_STATUS"
    fi
  else
    echo "  ⏳ No local cert ARN ($CERT_FILE)"
    echo "     Request with: ./scripts/request-certificate-testapp.sh"
    if ! has_secret "ACM_CERTIFICATE_ARN" || ! has_secret "CLOUDFRONT_CERTIFICATE_ARN"; then
      MISSING=1
    fi
  fi
  echo ""
  echo "================================================"
  echo ""
fi

if [ "$MISSING" -eq 0 ]; then
  echo "🎉 All required secrets present for $GH_ENV"
  exit 0
fi

echo "⚠️  Not ready to deploy to $GH_ENV"
echo ""
echo "Fix:"
echo "  Settings → Environments → $GH_ENV → Environment secrets"
echo "  Or: ./scripts/sync-github-secrets-from-tfvars.sh $GH_ENV"
if [ "$GH_ENV" = "staging" ]; then
  echo "  AWS runtime secrets: ./scripts/bootstrap-staging-secrets-from-platform.sh"
fi
exit 1
