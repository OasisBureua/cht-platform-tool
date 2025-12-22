#!/bin/bash
set -e

echo "🔐 ACM Certificate Request Helper"
echo ""

read -p "Enter your API domain (e.g., api.chtplatform.com): " API_DOMAIN
read -p "Enter your frontend domain (e.g., app.chtplatform.com): " FRONTEND_DOMAIN

echo ""
echo "📋 You need to request TWO certificates:"
echo ""
echo "1️⃣  ALB Certificate (for backend API)"
echo "   Domain: $API_DOMAIN"
echo "   Region: us-east-1"
echo ""
echo "2️⃣  CloudFront Certificate (for frontend)"
echo "   Domain: $FRONTEND_DOMAIN"
echo "   Region: us-east-1 (required for CloudFront)"
echo ""
echo "Requesting certificates..."
echo ""

# Request ALB certificate
echo "📝 Requesting ALB certificate..."
ALB_CERT_ARN=$(aws acm request-certificate \
  --domain-name $API_DOMAIN \
  --validation-method DNS \
  --region us-east-1 \
  --query CertificateArn \
  --output text)

echo "✅ ALB certificate requested: $ALB_CERT_ARN"
echo ""

# Request CloudFront certificate
echo "📝 Requesting CloudFront certificate..."
CF_CERT_ARN=$(aws acm request-certificate \
  --domain-name $FRONTEND_DOMAIN \
  --validation-method DNS \
  --region us-east-1 \
  --query CertificateArn \
  --output text)

echo "✅ CloudFront certificate requested: $CF_CERT_ARN"
echo ""

# Get validation records
echo "📋 DNS Validation Records:"
echo ""
echo "For $API_DOMAIN (ALB):"
aws acm describe-certificate \
  --certificate-arn $ALB_CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --output table

echo ""
echo "For $FRONTEND_DOMAIN (CloudFront):"
aws acm describe-certificate \
  --certificate-arn $CF_CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --output table

echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Add these DNS records to your domain's DNS provider:"
echo "   (Go to your domain registrar or DNS provider)"
echo ""
echo "2. Wait for validation (usually 5-30 minutes)"
echo "   Check status: aws acm describe-certificate --certificate-arn [ARN] --region us-east-1"
echo ""
echo "3. Once validated, update terraform.tfvars:"
echo "   acm_certificate_arn = \"$ALB_CERT_ARN\""
echo "   cloudfront_certificate_arn = \"$CF_CERT_ARN\""
echo "   domain_aliases = [\"$FRONTEND_DOMAIN\"]"
echo ""
echo "4. Deploy infrastructure: ./scripts/deploy.sh dev apply"
echo ""

# Save to file
cat > acm-certificates.txt << CERTS
# ACM Certificates for CHT Platform

API Domain: $API_DOMAIN
ALB Certificate ARN: $ALB_CERT_ARN

Frontend Domain: $FRONTEND_DOMAIN
CloudFront Certificate ARN: $CF_CERT_ARN

# Update terraform.tfvars with:
acm_certificate_arn        = "$ALB_CERT_ARN"
cloudfront_certificate_arn = "$CF_CERT_ARN"
domain_aliases             = ["$FRONTEND_DOMAIN"]
CERTS

echo "💾 Certificate ARNs saved to: acm-certificates.txt"