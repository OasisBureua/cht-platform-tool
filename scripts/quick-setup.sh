#!/bin/bash
set -e

echo "🚀 CHT Platform - Quick Setup"
echo "=============================="
echo ""

echo "This script will:"
echo "1. Verify all infrastructure files"
echo "2. Check AWS credentials"
echo "3. Check prerequisites"
echo "4. Prepare for deployment"
echo ""

read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  exit 0
fi

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform not installed"; exit 1; }
echo "  ✅ Terraform: $(terraform version -json | jq -r '.terraform_version')"

command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI not installed"; exit 1; }
echo "  ✅ AWS CLI: $(aws --version)"

command -v docker >/dev/null 2>&1 || { echo "❌ Docker not installed"; exit 1; }
echo "  ✅ Docker: $(docker --version)"

command -v node >/dev/null 2>&1 || { echo "❌ Node.js not installed"; exit 1; }
echo "  ✅ Node.js: $(node --version)"

# Check AWS credentials
echo ""
echo "🔐 Checking AWS credentials..."
if aws sts get-caller-identity > /dev/null 2>&1; then
  ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
  echo "  ✅ AWS Account: $ACCOUNT"
else
  echo "  ❌ AWS credentials not configured"
  echo "  Run: aws configure"
  exit 1
fi

# Verify infrastructure
echo ""
./scripts/verify-infrastructure.sh

echo ""
echo "✅ Quick setup complete!"
echo ""
echo "📋 You're ready to deploy!"
echo ""
echo "Next steps:"
echo "1. Review variables: cat infrastructure/terraform/environments/variables/dev.tfvars"
echo "2. Request SSL cert: ./scripts/request-certificates-communityhealth.sh"
echo "3. Build images: ./scripts/build-images.sh v1.0.0"
echo "4. Deploy: ./scripts/deploy-primary.sh dev"