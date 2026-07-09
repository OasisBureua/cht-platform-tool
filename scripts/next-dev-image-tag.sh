#!/usr/bin/env bash
# Dev semver tag helper — uses cht-dev-backend repo (separate from platform ECR).
exec "$(dirname "$0")/next-image-tag.sh" "${1:-cht-dev-backend}" "${2:-us-east-1}" ""
