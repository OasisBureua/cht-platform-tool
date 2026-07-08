#!/usr/bin/env bash
# Set deploy_backend / deploy_frontend outputs for GitHub Actions (dorny/paths-filter).
# Usage: ci-detect-deploy-scope.sh <event_name> <backend_changed> <frontend_changed> <infra_changed>
set -euo pipefail

EVENT_NAME="${1:?event name required}"
BACKEND_CHANGED="${2:-false}"
FRONTEND_CHANGED="${3:-false}"
INFRA_CHANGED="${4:-false}"

DEPLOY_BACKEND=false
DEPLOY_FRONTEND=false

if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
  DEPLOY_BACKEND=true
  DEPLOY_FRONTEND=true
else
  if [ "$BACKEND_CHANGED" = "true" ] || [ "$INFRA_CHANGED" = "true" ]; then
    DEPLOY_BACKEND=true
  fi
  if [ "$FRONTEND_CHANGED" = "true" ]; then
    DEPLOY_FRONTEND=true
  fi
fi

{
  echo "deploy_backend=$DEPLOY_BACKEND"
  echo "deploy_frontend=$DEPLOY_FRONTEND"
} >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT not set}"

echo "Deploy scope: backend=$DEPLOY_BACKEND frontend=$DEPLOY_FRONTEND"
