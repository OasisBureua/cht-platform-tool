#!/bin/bash
# Copy cht-platform-backend and cht-platform-worker tags from us-east-1 → us-east-2.
# Use when ECR replication is not configured, or for tags pushed before replication was enabled.
#
# Usage:
#   ./scripts/copy-ecr-to-us-east-2.sh v2.2.5
#   ./scripts/copy-ecr-to-us-east-2.sh v2.2.5 cht-platform-backend   # single repo
#
set -euo pipefail

VERSION="${1:?Usage: $0 <tag> [repo-name]}"
SINGLE_REPO="${2:-}"
SOURCE_REGION="${SOURCE_REGION:-us-east-1}"
DEST_REGION="${DEST_REGION:-us-east-2}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

REPOS=(cht-platform-backend cht-platform-worker)
if [ -n "$SINGLE_REPO" ]; then
  REPOS=("$SINGLE_REPO")
fi

echo "📦 Copy ECR images ${SOURCE_REGION} → ${DEST_REGION}"
echo "   Account: $ACCOUNT_ID"
echo "   Tag:     $VERSION"
echo ""

for REPO in "${REPOS[@]}"; do
  SRC="${ACCOUNT_ID}.dkr.ecr.${SOURCE_REGION}.amazonaws.com/${REPO}:${VERSION}"
  DST="${ACCOUNT_ID}.dkr.ecr.${DEST_REGION}.amazonaws.com/${REPO}:${VERSION}"

  echo "🔍 Checking source: $SRC"
  if ! aws ecr describe-images \
    --repository-name "$REPO" \
    --region "$SOURCE_REGION" \
    --image-ids "imageTag=${VERSION}" >/dev/null 2>&1; then
    echo "❌ Tag ${VERSION} not found in ${SOURCE_REGION}/${REPO}"
    exit 1
  fi

  echo "🔧 Ensuring repository exists in ${DEST_REGION}/${REPO}"
  aws ecr describe-repositories --repository-names "$REPO" --region "$DEST_REGION" >/dev/null 2>&1 \
    || aws ecr create-repository --repository-name "$REPO" --region "$DEST_REGION" >/dev/null

  echo "🔐 Docker login (${SOURCE_REGION}, ${DEST_REGION})"
  aws ecr get-login-password --region "$SOURCE_REGION" \
    | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${SOURCE_REGION}.amazonaws.com"
  aws ecr get-login-password --region "$DEST_REGION" \
    | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${DEST_REGION}.amazonaws.com"

  echo "⬇️  Pull $SRC"
  docker pull "$SRC"

  echo "🏷️  Tag → $DST"
  docker tag "$SRC" "$DST"

  echo "⬆️  Push $DST"
  docker push "$DST"

  echo "✅ ${REPO}:${VERSION} copied to ${DEST_REGION}"
  echo ""
done

echo "Done. Update dev.tfvars / deploy-secondary if needed:"
echo "  backend_image = \"${ACCOUNT_ID}.dkr.ecr.${SOURCE_REGION}.amazonaws.com/cht-platform-backend:${VERSION}\""
echo "  worker_image  = \"${ACCOUNT_ID}.dkr.ecr.${SOURCE_REGION}.amazonaws.com/cht-platform-worker:${VERSION}\""
