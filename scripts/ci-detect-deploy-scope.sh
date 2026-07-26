#!/usr/bin/env bash
# Set deploy_backend / deploy_frontend / deploy_infra for GitHub Actions (dorny/paths-filter).
#
# Lanes are independent:
#   - backend  → backend/** or worker/** only (images + ECS image roll)
#   - frontend → frontend/** only
#   - infra    → infrastructure/** (and related CI/scripts paths) only
#
# Usage: ci-detect-deploy-scope.sh <event_name> <backend_changed> <frontend_changed> <infra_changed>
set -euo pipefail

EVENT_NAME="${1:?event name required}"
BACKEND_CHANGED="${2:-false}"
FRONTEND_CHANGED="${3:-false}"
INFRA_CHANGED="${4:-false}"

DEPLOY_BACKEND=false
DEPLOY_FRONTEND=false
DEPLOY_INFRA=false

if [ "$EVENT_NAME" = "workflow_dispatch" ]; then
  # Manual runs deploy everything unless/until dispatch inputs are added.
  DEPLOY_BACKEND=true
  DEPLOY_FRONTEND=true
  DEPLOY_INFRA=true
else
  if [ "$BACKEND_CHANGED" = "true" ]; then
    DEPLOY_BACKEND=true
  fi
  if [ "$FRONTEND_CHANGED" = "true" ]; then
    DEPLOY_FRONTEND=true
  fi
  if [ "$INFRA_CHANGED" = "true" ]; then
    DEPLOY_INFRA=true
  fi
fi

{
  echo "deploy_backend=$DEPLOY_BACKEND"
  echo "deploy_frontend=$DEPLOY_FRONTEND"
  echo "deploy_infra=$DEPLOY_INFRA"
} >> "${GITHUB_OUTPUT:?GITHUB_OUTPUT not set}"

echo "Deploy scope: backend=$DEPLOY_BACKEND frontend=$DEPLOY_FRONTEND infra=$DEPLOY_INFRA"
