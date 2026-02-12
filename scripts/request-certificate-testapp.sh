#!/bin/bash
# Request ACM certificate for testapp.communityhealth.media
# DNS is on GoDaddy - add the CNAME record there after running this script

set -e

DOMAIN="testapp.communityhealth.media"
REGION="us-east-1"

echo "🔐 Request ACM Certificate for $DOMAIN"
echo "========================================"
echo ""
echo "Domain: $DOMAIN"
echo "Validation: DNS (add CNAME in GoDaddy)"
echo ""

# Request certificate (wildcard covers api.testapp, app.testapp, etc.)
CERT_ARN=$(aws acm request-certificate \
    --domain-name "*.${DOMAIN}" \
    --subject-alternative-names "${DOMAIN}" \
    --validation-method DNS \
    --region "$REGION" \
    --query 'CertificateArn' \
    --output text)

echo "✅ Certificate requested"
echo "   ARN: $CERT_ARN"
echo ""

# Wait for validation options to appear
sleep 5

echo "📋 DNS Validation Records (add in GoDaddy):"
echo ""

# ACM may return multiple validation records for wildcard + apex
aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$REGION" \
    --query 'Certificate.DomainValidationOptions[].[DomainName,ResourceRecord]' \
    --output table

echo ""
echo "📝 Add these CNAME records in GoDaddy (dns.godaddy.com):"
echo ""

for i in 0 1; do
    RECORD_NAME=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region "$REGION" \
        --query "Certificate.DomainValidationOptions[$i].ResourceRecord.Name" \
        --output text 2>/dev/null || true)
    RECORD_VALUE=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region "$REGION" \
        --query "Certificate.DomainValidationOptions[$i].ResourceRecord.Value" \
        --output text 2>/dev/null || true)
    if [ -n "$RECORD_NAME" ] && [ "$RECORD_NAME" != "None" ]; then
        echo "--- Record $((i+1)) ---"
        echo "Type:  CNAME"
        echo "Name:  $RECORD_NAME"
        echo "Value: $RECORD_VALUE"
        echo "TTL:   600"
        echo ""
    fi
done

# Simpler: get first record only (wildcard usually has one validation)
RECORD_NAME=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$REGION" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' \
    --output text)
RECORD_VALUE=$(aws acm describe-certificate \
    --certificate-arn "$CERT_ARN" \
    --region "$REGION" \
    --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Value' \
    --output text)

echo "Primary CNAME (add in GoDaddy):"
echo "  Name:  $RECORD_NAME"
echo "  Value: $RECORD_VALUE"
echo "  TTL:   600"
echo ""
echo "In GoDaddy: DNS Management → Add → Type: CNAME"
echo "  Name: _acme-challenge.testapp (or the Name above, minus .communityhealth.media)"
echo "  Value: (the Value above)"
echo ""

# Save ARN
mkdir -p infrastructure/terraform/environments/variables
echo "certificate_arn=\"$CERT_ARN\"" > infrastructure/terraform/environments/variables/.cert-arns-testapp
echo "testapp_domain=\"$DOMAIN\"" >> infrastructure/terraform/environments/variables/.cert-arns-testapp

echo "💾 Certificate ARN saved to infrastructure/terraform/environments/variables/.cert-arns-testapp"
echo ""
echo "📋 Next steps:"
echo "1. Add the CNAME record in GoDaddy"
echo "2. Wait 5-30 min for validation: ./scripts/check-certificates-status.sh testapp"
echo "3. Once ISSUED, update dev.tfvars: domain_name = \"$DOMAIN\", acm_certificate_arn, cloudfront_certificate_arn"
echo "4. Deploy: cd infrastructure/terraform/environments/us-east-1 && terraform apply -var-file=../variables/dev.tfvars"
