#!/usr/bin/env bash
# Clear CHT upstream Redis cache (catalog / Content Hub reads).
#
# Usage:
#   INTERNAL_CACHE_SECRET=... ./scripts/clear-upstream-cache.sh dev
#   INTERNAL_CACHE_SECRET=... ./scripts/clear-upstream-cache.sh dev contenthub
#
# Scopes: catalog | contenthub | all (default: all)
set -euo pipefail

ENV="${1:-}"
SCOPE="${2:-all}"

if [ -z "$ENV" ]; then
  echo "Usage: INTERNAL_CACHE_SECRET=... $0 <platform|dev> [catalog|contenthub|all]"
  exit 1
fi

case "$ENV" in
  platform|dev) ;;
  prod)
    ENV=platform
    ;;
  *)
    echo "Unknown environment: $ENV (use platform or dev)"
    exit 1
    ;;
esac

case "$SCOPE" in
  catalog|contenthub|all) ;;
  *)
    echo "Invalid scope: $SCOPE (use catalog, contenthub, or all)"
    exit 1
    ;;
esac

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VAR_DIR="$SCRIPT_DIR/../infrastructure/terraform/environments/variables"
VAR_FILE="$VAR_DIR/${ENV}.tfvars"
if [ ! -f "$VAR_FILE" ]; then
  VAR_FILE="$VAR_DIR/${ENV}.github.tfvars"
fi
if [ ! -f "$VAR_FILE" ]; then
  echo "❌ No variable file for $ENV (${ENV}.tfvars or ${ENV}.github.tfvars)"
  exit 1
fi
DOMAIN=$(grep -E '^domain_name[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')

if [ -z "${INTERNAL_CACHE_SECRET:-}" ]; then
  echo "Set INTERNAL_CACHE_SECRET (same value as backend INTERNAL_CACHE_SECRET / Secrets Manager)."
  exit 1
fi

URL="https://${DOMAIN}/api/internal/cache/clear?scope=${SCOPE}&cacheKey=${INTERNAL_CACHE_SECRET}"
echo "POST $URL (cacheKey in query)"

curl -fsS -X POST "$URL" \
  -H "Content-Type: application/json" | jq .

echo "Done."
