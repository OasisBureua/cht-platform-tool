#!/usr/bin/env bash
# One-time bootstrap: copy platform app secrets JSON into staging Secrets Manager.
# Preserves staging admin_bootstrap_secret if already set.
# Requires AWS CLI access to both secrets.
set -euo pipefail

PLATFORM_SECRET="cht-platform-app-secrets"
STAGING_SECRET="cht-platform-staging-app-secrets"

echo "📥 Reading platform secret: $PLATFORM_SECRET"
PLATFORM_JSON=$(aws secretsmanager get-secret-value --secret-id "$PLATFORM_SECRET" --query SecretString --output text)

echo "📥 Reading staging secret: $STAGING_SECRET"
STAGING_JSON=$(aws secretsmanager get-secret-value --secret-id "$STAGING_SECRET" --query SecretString --output text 2>/dev/null || echo "{}")

STAGING_BOOTSTRAP=$(echo "$STAGING_JSON" | jq -r '.admin_bootstrap_secret // empty')

echo "🔀 Merging platform → staging (keeping staging admin_bootstrap_secret if set)"
MERGED=$(echo "$PLATFORM_JSON" | jq --arg bootstrap "$STAGING_BOOTSTRAP" '
  . + {
    admin_bootstrap_secret: (if ($bootstrap | length) > 0 then $bootstrap else .admin_bootstrap_secret end)
  }
')

aws secretsmanager put-secret-value \
  --secret-id "$STAGING_SECRET" \
  --secret-string "$MERGED"

echo "✅ Updated $STAGING_SECRET"
echo "   Restart staging ECS backend to pick up new values:"
echo "   aws ecs update-service --cluster cht-platform-staging-cluster --service cht-platform-staging-backend --force-new-deployment"
