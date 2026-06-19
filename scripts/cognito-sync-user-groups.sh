#!/usr/bin/env bash
# Sync Cognito group membership (cht-hcp / cht-admin) from Postgres roles or CLI overrides.
#
# Usage:
#   ./scripts/cognito-sync-user-groups.sh dev
#   ADMIN_EMAILS="admin@example.com,other@example.com" ./scripts/cognito-sync-user-groups.sh dev
#
# Requires: aws CLI, jq. Uses the dev/platform Cognito pool in us-east-1.
set -euo pipefail

ENV=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
GROUP_HCP=cht-hcp
GROUP_ADMIN=cht-admin

case "$ENV" in
  dev) POOL_ID=${COGNITO_USER_POOL_ID:-us-east-1_J51gzfO0I} ;;
  platform)
    POOL_ID=${COGNITO_USER_POOL_ID:-}
    if [ -z "$POOL_ID" ]; then
      echo "Set COGNITO_USER_POOL_ID for platform, or pass via terraform output."
      exit 1
    fi
    ;;
  *)
    echo "Usage: $0 [dev|platform]"
    exit 1
    ;;
esac

add_to_group() {
  local username=$1 group=$2
  if ! aws cognito-idp admin-add-user-to-group \
    --region "$AWS_REGION" \
    --user-pool-id "$POOL_ID" \
    --username "$username" \
    --group-name "$group" >/dev/null; then
    echo "  warn: could not add $username to $group" >&2
  fi
}

remove_from_group() {
  local username=$1 group=$2
  if ! aws cognito-idp admin-remove-user-from-group \
    --region "$AWS_REGION" \
    --user-pool-id "$POOL_ID" \
    --username "$username" \
    --group-name "$group" >/dev/null; then
    echo "  warn: could not remove $username from $group" >&2
  fi
}

sync_user() {
  local email=$1 role=$2
  local username
  username=$(aws cognito-idp admin-get-user \
    --region "$AWS_REGION" \
    --user-pool-id "$POOL_ID" \
    --username "$email" \
    --query 'Username' \
    --output text 2>/dev/null || true)
  if [ -z "$username" ] || [ "$username" = "None" ]; then
    echo "  skip (not in Cognito): $email"
    return
  fi

  if [ "$role" = "ADMIN" ]; then
    add_to_group "$username" "$GROUP_ADMIN"
    remove_from_group "$username" "$GROUP_HCP"
    echo "  ADMIN → $GROUP_ADMIN: $email"
  else
    add_to_group "$username" "$GROUP_HCP"
    remove_from_group "$username" "$GROUP_ADMIN"
    echo "  HCP/KOL → $GROUP_HCP: $email"
  fi
}

echo "Syncing Cognito groups for pool $POOL_ID ($ENV)..."

TOKEN=""
while true; do
  if [ -n "$TOKEN" ]; then
    PAGE=$(aws cognito-idp list-users \
      --region "$AWS_REGION" \
      --user-pool-id "$POOL_ID" \
      --pagination-token "$TOKEN" \
      --output json)
  else
    PAGE=$(aws cognito-idp list-users \
      --region "$AWS_REGION" \
      --user-pool-id "$POOL_ID" \
      --output json)
  fi

  while IFS=$'\t' read -r _username email; do
    [ -z "$email" ] && continue
    role="HCP"
    if [ -n "${ADMIN_EMAILS:-}" ]; then
      lower=$(echo "$email" | tr '[:upper:]' '[:lower:]')
      IFS=',' read -ra ADMINS <<< "$ADMIN_EMAILS"
      for admin in "${ADMINS[@]}"; do
        admin_lower=$(echo "$admin" | tr '[:upper:]' '[:lower:]' | xargs)
        if [ "$lower" = "$admin_lower" ]; then
          role="ADMIN"
          break
        fi
      done
    fi
    sync_user "$email" "$role"
  done < <(echo "$PAGE" | jq -r '.Users[] | [.Username, (.Attributes[]? | select(.Name=="email") | .Value)] | @tsv')

  TOKEN=$(echo "$PAGE" | jq -r '.PaginationToken // empty')
  [ -z "$TOKEN" ] && break
done

echo "Done."
