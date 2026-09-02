#!/usr/bin/env bash
# Fail fast when required GitHub Environment secrets are missing/empty.
# Usage: verify-github-env-secrets.sh [development|staging|platform|production]
set -euo pipefail

ENV_LABEL="${1:-development}"
echo "Verifying GitHub secrets for: $ENV_LABEL"

require() {
  local env_name="$1"
  local gh_name="$2"
  if [ -z "${!env_name:-}" ]; then
    echo "::error::Missing GitHub secret $gh_name in Environment '$ENV_LABEL'. Add it under Settings → Environments → $ENV_LABEL → Environment secrets."
    return 1
  fi
}

missing=0
require YOUTUBE_API_KEY YOUTUBE_API_KEY || missing=1
require YOUTUBE_PLAYLIST_IDS YOUTUBE_PLAYLIST_IDS || missing=1
require ZOOM_ACCOUNT_ID ZOOM_ACCOUNT_ID || missing=1
require ZOOM_CLIENT_ID ZOOM_CLIENT_ID || missing=1
require ZOOM_CLIENT_SECRET ZOOM_CLIENT_SECRET || missing=1
require ZOOM_WEBHOOK_SECRET ZOOM_WEBHOOK_SECRET || missing=1
require ZOOM_SDK_KEY ZOOM_SDK_KEY || missing=1
require ZOOM_SDK_SECRET ZOOM_SDK_SECRET || missing=1
require JOTFORM_API_KEY JOTFORM_API_KEY || missing=1
require BILL_DEV_KEY BILL_DEV_KEY || missing=1
require BILL_USERNAME BILL_USERNAME || missing=1
require BILL_PASSWORD BILL_PASSWORD || missing=1
require BILL_ORG_ID BILL_ORG_ID || missing=1
require BILL_FUNDING_ACCOUNT_ID BILL_FUNDING_ACCOUNT_ID || missing=1
require HUBSPOT_ACCESS_TOKEN HUBSPOT_ACCESS_TOKEN || missing=1
require COGNITO_GOOGLE_CLIENT_ID COGNITO_GOOGLE_CLIENT_ID || missing=1
require COGNITO_GOOGLE_CLIENT_SECRET COGNITO_GOOGLE_CLIENT_SECRET || missing=1
require RECAPTCHA_SITE_KEY RECAPTCHA_SITE_KEY || missing=1
require RECAPTCHA_SECRET_KEY RECAPTCHA_SECRET_KEY || missing=1
require CONTENTHUB_API_KEY CONTENTHUB_API_KEY || missing=1
require INTERNAL_CACHE_SECRET INTERNAL_CACHE_SECRET || missing=1

if [ "$missing" -ne 0 ]; then
  echo ""
  echo "Terraform will write empty strings to Secrets Manager when these are missing."
  if [ "$ENV_LABEL" = "staging" ] || [ "$ENV_LABEL" = "development" ]; then
    echo "Check GitHub: ./scripts/verify-github-secrets.sh $ENV_LABEL"
    echo "AWS Secrets Manager: ./scripts/bootstrap-staging-secrets-from-platform.sh"
  else
    echo "From platform.tfvars: ./scripts/sync-github-secrets-from-tfvars.sh platform"
    echo "Check GitHub: ./scripts/verify-github-secrets.sh platform"
  fi
  exit 1
fi

echo "✅ Required GitHub secrets are present for $ENV_LABEL"
