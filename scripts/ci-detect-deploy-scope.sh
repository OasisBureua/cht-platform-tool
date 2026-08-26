#!/usr/bin/env bash
# Set deploy_backend / deploy_frontend / deploy_infra for GitHub Actions.
#
# Lanes are independent and only turn on when that tree actually changed:
#   - backend  → backend/** or worker/** (images + ECS image roll)
#   - frontend → frontend/**
#   - infra    → infrastructure/**
#
# force_all=true is the escape hatch (manual "deploy all", or when the change
# base SHA cannot be resolved). workflow_dispatch does NOT imply force_all.
#
# Usage: ci-detect-deploy-scope.sh <force_all> <backend_changed> <frontend_changed> <infra_changed>
set -euo pipefail

FORCE_ALL="${1:-false}"
BACKEND_CHANGED="${2:-false}"
FRONTEND_CHANGED="${3:-false}"
INFRA_CHANGED="${4:-false}"

DEPLOY_BACKEND=false
DEPLOY_FRONTEND=false
DEPLOY_INFRA=false

if [ "$FORCE_ALL" = "true" ]; then
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

echo "Deploy scope: backend=$DEPLOY_BACKEND frontend=$DEPLOY_FRONTEND infra=$DEPLOY_INFRA (force_all=$FORCE_ALL)"
