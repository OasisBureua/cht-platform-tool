#!/bin/bash
set -e

echo "🔐 Setting up GitHub Actions OIDC for AWS (PRODUCTION)"
echo "======================================================="
echo ""
echo "⚠️  This should be run in your PRODUCTION AWS account"
echo ""

read -p "Continue? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    exit 0
fi

# Your GitHub username/org
read -p "Enter GitHub username or org: " GITHUB_USER
read -p "Enter repository name: " REPO_NAME

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo ""
echo "📋 Production Configuration:"
echo "  AWS Account: $AWS_ACCOUNT_ID"
echo "  GitHub: $GITHUB_USER/$REPO_NAME"
echo ""

# Create trust policy (production - more restrictive)
cat > /tmp/github-trust-policy-prod.json << TRUST
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": [
            "repo:${GITHUB_USER}/${REPO_NAME}:ref:refs/tags/v*",
            "repo:${GITHUB_USER}/${REPO_NAME}:environment:production"
          ]
        }
      }
    }
  ]
}
TRUST

# Create OIDC provider
echo "🔧 Creating OIDC provider..."
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  2>/dev/null || echo "OIDC provider already exists"

# Create role for production
echo "👤 Creating IAM role for GitHub Actions (Production)..."
ROLE_ARN=$(aws iam create-role \
  --role-name GitHubActions-CHT-Platform-Prod \
  --assume-role-policy-document file:///tmp/github-trust-policy-prod.json \
  --query 'Role.Arn' \
  --output text 2>/dev/null || \
  aws iam get-role --role-name GitHubActions-CHT-Platform-Prod --query 'Role.Arn' --output text)

echo "✅ Role created: $ROLE_ARN"

# Attach scoped deploy policy (replace AdministratorAccess)
echo "📎 Attaching scoped deploy policy..."
POLICY_NAME="GitHubActions-CHT-Platform-Deploy"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_ARN=$(aws iam create-policy \
  --policy-name "$POLICY_NAME" \
  --policy-document "file://${SCRIPT_DIR}/iam/github-actions-deploy-policy.json" \
  --query 'Policy.Arn' \
  --output text 2>/dev/null || \
  aws iam get-policy --policy-arn "arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${POLICY_NAME}" --query 'Policy.Arn' --output text)

aws iam attach-role-policy \
  --role-name GitHubActions-CHT-Platform-Prod \
  --policy-arn "$POLICY_ARN"

echo ""
echo "✅ Production OIDC setup complete!"
echo ""
echo "📋 Add this to GitHub production environment secrets:"
echo ""
echo "AWS_ROLE_ARN=$ROLE_ARN"
echo ""

rm /tmp/github-trust-policy-prod.json
