#!/bin/bash
set -e

VERSION=${1:-latest}

echo "🔨 Building Docker images (version: $VERSION)"
echo ""

# Build Backend
echo "📦 Building backend image..."
cd backend
docker build -t cht-platform-backend:$VERSION .
cd ..
echo "✅ Backend image built"
echo ""

# Build Worker
echo "📦 Building worker image..."
cd worker
docker build -t cht-platform-worker:$VERSION .
cd ..
echo "✅ Worker image built"
echo ""

echo "✅ All images built successfully!"
echo ""
echo "Images:"
echo "  - cht-platform-backend:$VERSION"
echo "  - cht-platform-worker:$VERSION"
echo ""
echo "Next: ./scripts/push-images.sh $VERSION"
