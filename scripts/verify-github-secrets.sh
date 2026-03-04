#!/bin/bash

echo "🔍 Verifying GitHub Environment Setup"
echo "======================================"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI not installed"
    echo "   Install: brew install gh"
    echo "   Then run: gh auth login"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub"
    echo "   Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI authenticated"
echo ""

# List secrets in development environment
echo "📋 Development Environment Secrets:"
echo ""

REQUIRED_SECRETS=(
    "AWS_ROLE_ARN"
    "AUTH0_DOMAIN"
    "AUTH0_CLIENT_ID"
    "AUTH0_AUDIENCE"
)

OPTIONAL_SECRETS=(
    "ACM_CERTIFICATE_ARN"
    "CLOUDFRONT_CERTIFICATE_ARN"
    "BILL_DEV_KEY"
    "BILL_SESSION_ID"
    "BILL_FUNDING_ACCOUNT_ID"
)

echo "Required for deployment:"
for secret in "${REQUIRED_SECRETS[@]}"; do
    if gh secret list --env development | grep -q "$secret"; then
        echo "  ✅ $secret"
    else
        echo "  ❌ $secret (MISSING - deployment will fail!)"
    fi
done

echo ""
echo "Optional (can add later):"
for secret in "${OPTIONAL_SECRETS[@]}"; do
    if gh secret list --env development | grep -q "$secret"; then
        echo "  ✅ $secret"
    else
        echo "  ⏳ $secret (not set)"
    fi
done

echo ""
echo "================================================"
echo ""

# Check if all required secrets are set
MISSING=0
for secret in "${REQUIRED_SECRETS[@]}"; do
    if ! gh secret list --env development | grep -q "$secret"; then
        MISSING=1
    fi
done

# Check certificate status
echo "📜 SSL Certificate Status:"
if [ -f "infrastructure/terraform/environments/variables/.cert-arns-dev" ]; then
    source infrastructure/terraform/environments/variables/.cert-arns-dev
    
    if [ -n "$us_east_1_cert_arn" ]; then
        CERT_STATUS=$(aws acm describe-certificate \
            --certificate-arn "$us_east_1_cert_arn" \
            --region us-east-1 \
            --query 'Certificate.Status' \
            --output text 2>/dev/null || echo "ERROR")
        
        if [ "$CERT_STATUS" == "ISSUED" ]; then
            echo "  ✅ Certificate ISSUED and ready!"
            
            # Check if cert ARN is in GitHub secrets
            if gh secret list --env development | grep -q "ACM_CERTIFICATE_ARN"; then
                echo "  ✅ Certificate ARN added to GitHub"
            else
                echo "  ⚠️  Certificate ARN NOT in GitHub secrets"
                echo "     Add with: gh secret set ACM_CERTIFICATE_ARN --env development --body \"$us_east_1_cert_arn\""
                echo "     Add with: gh secret set CLOUDFRONT_CERTIFICATE_ARN --env development --body \"$us_east_1_cert_arn\""
                MISSING=1
            fi
        else
            echo "  ⏳ Certificate status: $CERT_STATUS"
            echo "     Wait for ISSUED status before deploying"
        fi
    else
        echo "  ❌ Certificate ARN not found"
    fi
else
    echo "  ⏳ Certificate not requested yet"
fi

echo ""
echo "================================================"
echo ""

if [ $MISSING -eq 0 ] && [ "$CERT_STATUS" == "ISSUED" ]; then
    echo "🎉 ALL CHECKS PASSED - Ready to deploy!"
    echo ""
    echo "Next steps:"
    echo "1. Manual deployment: ./scripts/deploy-primary.sh dev"
    echo "2. Or enable GitHub Actions: mv .github/workflows-future/*.yml .github/workflows/"
else
    echo "⚠️  Not ready to deploy yet"
    echo ""
    if [ $MISSING -eq 1 ]; then
        echo "Missing required secrets - add them to GitHub"
    fi
    if [ "$CERT_STATUS" != "ISSUED" ]; then
        echo "SSL certificate not ready - wait for validation"
    fi
fi

echo ""
