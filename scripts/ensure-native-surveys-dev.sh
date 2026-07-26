#!/bin/bash
# Convert dev webinars from Jotform embeds to native surveys (admin API).
#
# Usage:
#   export CHT_ADMIN_TOKEN="<session JWT from devapp after admin login>"
#   ./scripts/ensure-native-surveys-dev.sh              # all published webinars
#   ./scripts/ensure-native-surveys-dev.sh <program-id>   # one program
#
# Requires backend with native survey support deployed to dev.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/dev.tfvars"
DOMAIN=$(grep -E '^domain_name[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/')
API_BASE="${CHT_API_BASE:-https://${DOMAIN}/api}"

if [ -z "${CHT_ADMIN_TOKEN:-}" ]; then
  echo "Set CHT_ADMIN_TOKEN to an admin session JWT (DevTools → Application → session cookie or Authorization header)."
  exit 1
fi

AUTH_HEADER="Authorization: Bearer ${CHT_ADMIN_TOKEN}"

if [ -n "${1:-}" ]; then
  echo "Ensuring native surveys for program $1 ..."
  curl -sS -X POST "${API_BASE}/admin/programs/${1}/native-surveys" \
    -H "$AUTH_HEADER" \
    -H 'Content-Type: application/json' | jq .
else
  echo "Ensuring native surveys for all published webinars on ${DOMAIN} ..."
  curl -sS -X POST "${API_BASE}/admin/webinars/ensure-native-surveys" \
    -H "$AUTH_HEADER" \
    -H 'Content-Type: application/json' | jq .
fi

echo ""
echo "Done. Hard-refresh devapp and re-open registration / post-event flows to use native forms."
