#!/usr/bin/env bash
# Verify GitHub Environment "staging" has secrets required by deploy-staging.yml.
# Usage: ./scripts/verify-github-staging-secrets.sh
set -euo pipefail

GH_ENV="staging"

echo "🔍 Verifying GitHub Environment: $GH_ENV"
echo "======================================"
echo ""

if ! command -v gh &> /dev/null; then
  echo "⚠️  GitHub CLI not installed"
  echo "   Install: brew install gh"
  echo "   Then run: gh auth login"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo "❌ Not authenticated with GitHub"
  echo "   Run: gh auth login"
  exit 1
fi

echo "✅ GitHub CLI authenticated"
echo ""

if ! gh api "repos/{owner}/{repo}/environments/$GH_ENV" &> /dev/null; then
  echo "❌ GitHub environment '$GH_ENV' not found"
  echo "   Create it: Settings → Environments → New environment → $GH_ENV"
  exit 1
fi

STAGING_SECRETS=$(gh secret list --env "$GH_ENV" 2>/dev/null || true)

has_secret() {
  echo "$STAGING_SECRETS" | grep -qE "^${1}[[:space:]]"
}

# Matches verify-github-env-secrets.sh + deploy-staging.yml terraform/OIDC usage
REQUIRED_SECRETS=(
  "AWS_ROLE_ARN"
  "ACM_CERTIFICATE_ARN"
  "CLOUDFRONT_CERTIFICATE_ARN"
  "SUPABASE_ANON_KEY"
  "GOTRUE_JWT_SECRET"
  "MEDIAHUB_API_KEY"
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
echo "Required for deploy-staging.yml:"
MISSING=0
for secret in "${REQUIRED_SECRETS[@]}"; do
  if has_secret "$secret"; then
    echo "  ✅ $secret"
  else
    echo "  ❌ $secret (MISSING — deploy will fail or write empty values)"
    MISSING=1
  fi
done

echo ""
echo "Optional (terraform apply; not checked in CI verify step):"
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

CERT_STATUS=""
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

  if [ "$CERT_STATUS" == "ISSUED" ]; then
    echo "  ✅ Certificate ISSUED ($CERT_ARN)"

    if has_secret "ACM_CERTIFICATE_ARN"; then
      echo "  ✅ ACM_CERTIFICATE_ARN set in GitHub"
    else
      echo "  ⚠️  ACM_CERTIFICATE_ARN not in GitHub"
      echo "     gh secret set ACM_CERTIFICATE_ARN --env $GH_ENV --body \"$CERT_ARN\""
      MISSING=1
    fi

    if has_secret "CLOUDFRONT_CERTIFICATE_ARN"; then
      echo "  ✅ CLOUDFRONT_CERTIFICATE_ARN set in GitHub"
    else
      echo "  ⚠️  CLOUDFRONT_CERTIFICATE_ARN not in GitHub"
      echo "     gh secret set CLOUDFRONT_CERTIFICATE_ARN --env $GH_ENV --body \"$CERT_ARN\""
      MISSING=1
    fi
  else
    echo "  ⏳ Certificate status: $CERT_STATUS"
    echo "     Wait for ISSUED before deploying"
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

if [ "$MISSING" -eq 0 ]; then
  echo "🎉 ALL CHECKS PASSED — staging GitHub secrets look ready"
  echo ""
  echo "Next: push to staging branch or run Deploy to Staging workflow"
  echo "  https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions"
else
  echo "⚠️  Not ready to deploy to staging"
  echo ""
  echo "Add missing secrets:"
  echo "  Settings → Environments → $GH_ENV → Environment secrets"
  echo "  Or: gh secret set SECRET_NAME --env $GH_ENV"
  echo ""
  echo "From platform.tfvars: ./scripts/sync-github-secrets-from-tfvars.sh staging"
  echo "AWS app secrets (runtime): ./scripts/bootstrap-staging-secrets-from-platform.sh"
  exit 1
fi

echo ""
