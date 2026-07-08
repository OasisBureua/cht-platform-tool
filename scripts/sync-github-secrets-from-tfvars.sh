#!/usr/bin/env bash
# Sync Terraform tfvars application secrets into a GitHub Environment.
# Default: platform.tfvars → platform (used by deploy-prod.yml "Deploy to Platform").
#
# Usage:
#   ./scripts/sync-github-secrets-from-tfvars.sh [platform|production|staging|development]
#   ./scripts/sync-github-secrets-from-tfvars.sh staging --tfvars infrastructure/terraform/environments/variables/staging.tfvars
#   ./scripts/sync-github-secrets-from-tfvars.sh platform --dry-run
#   ./scripts/sync-github-secrets-from-tfvars.sh platform --with-aws-role
#
# Requires: gh auth login, repo admin (or secrets: write). AWS CLI only for --with-aws-role.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

GH_ENV="platform"
TFVARS="infrastructure/terraform/environments/variables/platform.tfvars"
DRY_RUN=""
WITH_AWS_ROLE=""
AWS_ROLE_ARN_OVERRIDE=""

normalize_gh_env() {
  case "$1" in
    production|platform) echo "platform" ;;
    staging|development) echo "$1" ;;
    *) return 1 ;;
  esac
}

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \?//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    production|platform|staging|development)
      GH_ENV=$(normalize_gh_env "$1") || { echo "Unknown environment: $1" >&2; exit 1; }
      ;;
    --tfvars) shift; TFVARS="${1:?--tfvars requires a path}" ;;
    --dry-run) DRY_RUN=1 ;;
    --with-aws-role) WITH_AWS_ROLE=1 ;;
    --aws-role-arn) shift; AWS_ROLE_ARN_OVERRIDE="${1:?--aws-role-arn requires a value}"; WITH_AWS_ROLE=1 ;;
    *) echo "Unknown argument: $1" >&2; usage 1 ;;
  esac
  shift
done

if [ ! -f "$TFVARS" ]; then
  echo "❌ Tfvars file not found: $TFVARS"
  if [ -f "${TFVARS}.example" ]; then
    echo "   cp ${TFVARS}.example $TFVARS"
  fi
  exit 1
fi

if ! command -v gh &>/dev/null; then
  echo "❌ GitHub CLI not installed (brew install gh && gh auth login)"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "❌ Not authenticated with GitHub (gh auth login)"
  exit 1
fi

if ! gh api "repos/{owner}/{repo}/environments/$GH_ENV" &>/dev/null; then
  echo "❌ GitHub environment '$GH_ENV' not found"
  echo "   Create: Settings → Environments → New environment → $GH_ENV"
  exit 1
fi

# tfvars_key:GITHUB_SECRET_NAME (one per line)
MAPPINGS=$(cat <<'EOF'
acm_certificate_arn:ACM_CERTIFICATE_ARN
cloudfront_certificate_arn:CLOUDFRONT_CERTIFICATE_ARN
supabase_anon_key:SUPABASE_ANON_KEY
gotrue_jwt_secret:GOTRUE_JWT_SECRET
mediahub_api_key:MEDIAHUB_API_KEY
youtube_api_key:YOUTUBE_API_KEY
youtube_playlist_ids:YOUTUBE_PLAYLIST_IDS
zoom_account_id:ZOOM_ACCOUNT_ID
zoom_client_id:ZOOM_CLIENT_ID
zoom_client_secret:ZOOM_CLIENT_SECRET
zoom_webhook_secret:ZOOM_WEBHOOK_SECRET
zoom_sdk_key:ZOOM_SDK_KEY
zoom_sdk_secret:ZOOM_SDK_SECRET
jotform_api_key:JOTFORM_API_KEY
bill_dev_key:BILL_DEV_KEY
bill_username:BILL_USERNAME
bill_password:BILL_PASSWORD
bill_org_id:BILL_ORG_ID
bill_funding_account_id:BILL_FUNDING_ACCOUNT_ID
bill_webhook_secret:BILL_WEBHOOK_SECRET
bill_mfa_remember_me_id:BILL_MFA_REMEMBER_ME_ID
bill_mfa_device_name:BILL_MFA_DEVICE_NAME
admin_bootstrap_secret:ADMIN_BOOTSTRAP_SECRET
hubspot_access_token:HUBSPOT_ACCESS_TOKEN
cognito_google_client_id:COGNITO_GOOGLE_CLIENT_ID
cognito_google_client_secret:COGNITO_GOOGLE_CLIENT_SECRET
recaptcha_site_key:RECAPTCHA_SITE_KEY
recaptcha_secret_key:RECAPTCHA_SECRET_KEY
contenthub_api_key:CONTENTHUB_API_KEY
internal_cache_secret:INTERNAL_CACHE_SECRET
EOF
)

# Read a single HCL string assignment from tfvars (quoted or unquoted).
read_tfvar() {
  local key="$1"
  local file="$2"
  local line
  line=$(grep -E "^[[:space:]]*${key}[[:space:]]*=" "$file" 2>/dev/null | grep -v '^[[:space:]]*#' | tail -1) || return 1
  if [[ "$line" =~ \"([^\"]*)\" ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return 0
  fi
  if [[ "$line" =~ =[[:space:]]*([^[:space:]#]+) ]]; then
    printf '%s' "${BASH_REMATCH[1]}"
    return 0
  fi
  return 1
}

set_github_secret() {
  local name="$1"
  local value="$2"
  if [ -n "$DRY_RUN" ]; then
    echo "  [dry-run] would set $name"
    return 0
  fi
  printf '%s' "$value" | gh secret set "$name" --env "$GH_ENV"
  echo "  ✅ $name"
}

aws_role_for_env() {
  case "$1" in
    platform|production) echo "GitHubActions-CHT-Platform" ;;
    staging|development) echo "GitHubActions-CHT-Platform" ;;
    *) return 1 ;;
  esac
}

echo "🔐 Sync GitHub Environment secrets from tfvars"
echo "============================================="
echo "  Environment: $GH_ENV"
echo "  Tfvars:      $TFVARS"
[ -n "$DRY_RUN" ] && echo "  Mode:        dry-run (no changes)"
echo ""

SET_COUNT=0
SKIP_COUNT=0

while IFS=: read -r tf_key gh_name; do
  [ -z "$tf_key" ] && continue
  value=""
  if value=$(read_tfvar "$tf_key" "$TFVARS" 2>/dev/null); then
    :
  else
    echo "  ⏭️  $gh_name (no $tf_key in tfvars)"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  fi
  if [ -z "$value" ]; then
    echo "  ⏭️  $gh_name (empty $tf_key)"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  fi
  set_github_secret "$gh_name" "$value"
  SET_COUNT=$((SET_COUNT + 1))
done <<< "$MAPPINGS"

if [ -n "$WITH_AWS_ROLE" ]; then
  role_arn="$AWS_ROLE_ARN_OVERRIDE"
  if [ -z "$role_arn" ]; then
    if ! command -v aws &>/dev/null; then
      echo "  ⚠️  AWS_ROLE_ARN skipped (aws CLI not installed; use --aws-role-arn)"
    else
      role_name=$(aws_role_for_env "$GH_ENV") || true
      if [ -n "${role_name:-}" ]; then
        role_arn=$(aws iam get-role --role-name "$role_name" --query 'Role.Arn' --output text 2>/dev/null || true)
      fi
      if [ -z "${role_arn:-}" ]; then
        echo "  ⚠️  AWS_ROLE_ARN skipped (could not resolve IAM role $role_name)"
      else
        set_github_secret "AWS_ROLE_ARN" "$role_arn"
        SET_COUNT=$((SET_COUNT + 1))
      fi
    fi
  else
    set_github_secret "AWS_ROLE_ARN" "$role_arn"
    SET_COUNT=$((SET_COUNT + 1))
  fi
fi

echo ""
if [ -n "$DRY_RUN" ]; then
  echo "Dry-run complete. Re-run without --dry-run to apply."
else
  echo "Done: $SET_COUNT secret(s) set, $SKIP_COUNT skipped."
  echo ""
  echo "Verify:"
  echo "  ./scripts/verify-github-secrets.sh $GH_ENV"
fi
