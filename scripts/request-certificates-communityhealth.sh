#!/bin/bash
set -e

DOMAIN="communityhealth.media"
FRONTEND_SUBDOMAIN="app"
API_SUBDOMAIN="api"

echo "🔐 Requesting SSL Certificates for Community Health Media"
echo ""
echo "Domain: $DOMAIN"
echo "Subdomains:"
echo "  - Frontend: $FRONTEND_SUBDOMAIN.$DOMAIN"
echo "  - Backend:  $API_SUBDOMAIN.$DOMAIN"
echo ""

# Option 1: Request wildcard certificate (covers both)
echo "📝 Requesting wildcard certificate..."
WILDCARD_CERT_ARN=$(aws acm request-certificate \
  --domain-name "*.$DOMAIN" \
  --subject-alternative-names "$DOMAIN" \
  --validation-method DNS \
  --region us-east-1 \
  --query CertificateArn \
  --output text)

echo "✅ Wildcard certificate requested: $WILDCARD_CERT_ARN"
echo ""

# Get validation record
echo "📋 DNS Validation Record to add to communityhealth.media:"
aws acm describe-certificate \
  --certificate-arn $WILDCARD_CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --output table

echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Share this DNS record with the team managing communityhealth.media:"
echo "   (They need to add it to their DNS provider - GoDaddy, Cloudflare, Route53, etc.)"
echo ""
echo "2. Wait for validation (usually 5-30 minutes)"
echo "   Check: ./scripts/check-certificate-status.sh"
echo ""
echo "3. Once ISSUED, update terraform.tfvars:"
echo "   acm_certificate_arn        = \"$WILDCARD_CERT_ARN\""
echo "   cloudfront_certificate_arn = \"$WILDCARD_CERT_ARN\""
echo "   domain_aliases             = [\"$FRONTEND_SUBDOMAIN.$DOMAIN\"]"
echo ""

# Save to file
cat > certificate-info-communityhealth.txt << CERT
# CHT Platform SSL Certificates

Domain: $DOMAIN
Certificate ARN: $WILDCARD_CERT_ARN

Covers:
- $FRONTEND_SUBDOMAIN.$DOMAIN (Frontend - User login portal)
- $API_SUBDOMAIN.$DOMAIN (Backend API)

## Update terraform.tfvars with:
acm_certificate_arn        = "$WILDCARD_CERT_ARN"
cloudfront_certificate_arn = "$WILDCARD_CERT_ARN"
domain_aliases             = ["$FRONTEND_SUBDOMAIN.$DOMAIN"]

## DNS Records to Add (after deployment):
1. Frontend (CloudFront):
   Type: CNAME
   Name: $FRONTEND_SUBDOMAIN
   Value: [CloudFront DNS from terraform output]
   
2. Backend (ALB):
   Type: CNAME
   Name: $API_SUBDOMAIN
   Value: [ALB DNS from terraform output]
CERT

echo "💾 Certificate info saved to: certificate-info-communityhealth.txt"
