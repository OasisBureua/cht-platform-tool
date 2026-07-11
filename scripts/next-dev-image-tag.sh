#!/usr/bin/env bash
# Dev semver tag helper — uses cht-dev-backend repo (separate from platform ECR).
# ECS fallback uses cht-dev-backend task family so tag bumps survive an ECR wipe.
exec "$(dirname "$0")/next-image-tag.sh" \
  "${1:-cht-dev-backend}" \
  "${2:-us-east-1}" \
  "" \
  "cht-dev-backend"
