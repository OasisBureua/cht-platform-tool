#!/bin/bash
set -e

echo "🔐 Setting up GitHub Actions OIDC for AWS"
echo "=========================================="
echo ""

# Your GitHub username/org
read -p "Enter GitHub username or org (e.g., yourusername): " GITHUB_USER
read -p "Enter repository name (e.g., cht-platform-tool): " REPO_NAME

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo ""
echo "📋 Configuration:"
echo "  AWS Account: $AWS_ACCOUNT_ID"
echo "  GitHub: $GITHUB_USER/$REPO_NAME"
echo ""

# Create trust policy
cat > /tmp/github-trust-policy.json << TRUST
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
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_USER}/${REPO_NAME}:*"
        }
      }
    }
  ]
}
TRUST

# Create OIDC provider (if doesn't exist)
echo "🔧 Creating OIDC provider..."
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  2>/dev/null || echo "OIDC provider already exists"

# Create role for GitHub Actions
echo "👤 Creating IAM role for GitHub Actions..."
ROLE_ARN=$(aws iam create-role \
  --role-name GitHubActions-CHT-Platform \
  --assume-role-policy-document file:///tmp/github-trust-policy.json \
  --query 'Role.Arn' \
  --output text 2>/dev/null || \
  aws iam get-role --role-name GitHubActions-CHT-Platform --query 'Role.Arn' --output text)

echo "✅ Role created: $ROLE_ARN"

# Attach policies
echo "📎 Attaching policies..."
aws iam attach-role-policy \
  --role-name GitHubActions-CHT-Platform \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Add this to GitHub Secrets:"
echo ""
echo "AWS_ROLE_ARN=$ROLE_ARN"
echo ""
echo "Then update your workflow to use:"
echo ""
echo "- uses: aws-actions/configure-aws-credentials@v4"
echo "  with:"
echo "    role-to-assume: \${{ secrets.AWS_ROLE_ARN }}"
echo "    aws-region: us-east-1"
echo ""

rm /tmp/github-trust-policy.json
