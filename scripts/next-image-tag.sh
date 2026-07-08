#!/usr/bin/env bash
# Compute the next semver ECR tag for CHT Platform images.
# Dev uses plain semver (3.0.0, 3.0.1, …); prod uses v-prefixed (v3.0.0, v3.0.1, …).
# Ignores other tags (dev-latest, platform-latest, sha tags, etc.).
#
# Usage:
#   ./scripts/next-image-tag.sh [ECR_REPO] [AWS_REGION] [PREFIX]
#   ./scripts/next-image-tag.sh cht-platform-backend us-east-1      # → 3.0.0
#   ./scripts/next-image-tag.sh cht-platform-backend us-east-1 v    # → v3.0.0

set -euo pipefail

REPO="${1:-cht-platform-backend}"
REGION="${2:-us-east-1}"
PREFIX="${3:-}"

if ! command -v aws >/dev/null 2>&1; then
  echo "::error::aws CLI required" >&2
  exit 1
fi

TAGS_FILE="$(mktemp)"
trap 'rm -f "$TAGS_FILE"' EXIT

if [ -n "$PREFIX" ]; then
  TAG_PATTERN="^${PREFIX}[0-9]+\\.[0-9]+\\.[0-9]+$"
else
  TAG_PATTERN='^[0-9]+\.[0-9]+\.[0-9]+$'
fi

aws ecr describe-images \
  --repository-name "$REPO" \
  --region "$REGION" \
  --query 'imageDetails[*].imageTags[]' \
  --output text 2>/dev/null \
| tr '\t' '\n' \
| grep -E "$TAG_PATTERN" \
| sort -V \
| uniq > "$TAGS_FILE" || true

if [ ! -s "$TAGS_FILE" ]; then
  echo "${PREFIX}3.0.0"
  exit 0
fi

LATEST="$(tail -1 "$TAGS_FILE")"
VERSION="${LATEST#"$PREFIX"}"
IFS=. read -r major minor patch <<< "$VERSION"
echo "${PREFIX}${major}.${minor}.$((patch + 1))"
