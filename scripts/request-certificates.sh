#!/bin/bash
set -e

echo "🔐 CHT Platform - Request SSL Certificates"
echo "=========================================="
echo ""

# Determine environment
ENV=${1:-dev}

if [ "$ENV" != "dev" ] && [ "$ENV" != "prod" ]; then
    echo "❌ Invalid environment. Use: dev or prod"
    exit 1
fi

echo "📦 Environment: $ENV"
echo ""

DOMAIN="communityhealth.media"

if [ "$ENV" == "dev" ]; then
    echo "🔵 DEV Mode: Requesting certificate for us-east-1 only"
    echo ""
    
    # Request single wildcard certificate for dev
    CERT_ARN=$(aws acm request-certificate \
        --domain-name "*.${DOMAIN}" \
        --subject-alternative-names "${DOMAIN}" \
        --validation-method DNS \
        --region us-east-1 \
        --query 'CertificateArn' \
        --output text)
    
    echo "✅ Certificate requested for us-east-1"
    echo "   ARN: $CERT_ARN"
    echo ""
    
    # Get validation records
    sleep 5
    
    echo "📋 DNS Validation Records:"
    echo ""
    
    aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region us-east-1 \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
        --output table
    
    echo ""
    echo "📝 Add this CNAME record to your DNS:"
    echo ""
    
    RECORD_NAME=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region us-east-1 \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' \
        --output text)
    
    RECORD_VALUE=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region us-east-1 \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Value' \
        --output text)
    
    echo "Type:  CNAME"
    echo "Name:  $RECORD_NAME"
    echo "Value: $RECORD_VALUE"
    echo "TTL:   300"
    echo ""
    
    echo "💾 Saving certificate ARN..."
    echo "us_east_1_cert_arn=\"$CERT_ARN\"" > infrastructure/terraform/environments/variables/.cert-arns-dev
    
    echo ""
    echo "✅ Certificate ARN saved to: infrastructure/terraform/environments/variables/.cert-arns-dev"
    echo ""
    echo "📋 Next steps:"
    echo "1. Add the CNAME record above to your DNS"
    echo "2. Wait 5-30 minutes for validation"
    echo "3. Check status: ./scripts/check-certificate-status.sh dev"
    echo "4. Once ISSUED, update dev.tfvars with the ARN"
    
elif [ "$ENV" == "prod" ]; then
    echo "🔴 PROD Mode: Requesting certificates for us-east-1 AND us-east-2"
    echo ""
    
    # Request certificate for us-east-1
    echo "📍 Requesting certificate for us-east-1..."
    CERT_ARN_EAST1=$(aws acm request-certificate \
        --domain-name "*.${DOMAIN}" \
        --subject-alternative-names "${DOMAIN}" \
        --validation-method DNS \
        --region us-east-1 \
        --query 'CertificateArn' \
        --output text)
    
    echo "✅ us-east-1 certificate requested"
    echo "   ARN: $CERT_ARN_EAST1"
    echo ""
    
    # Request certificate for us-east-2
    echo "📍 Requesting certificate for us-east-2..."
    CERT_ARN_EAST2=$(aws acm request-certificate \
        --domain-name "*.${DOMAIN}" \
        --subject-alternative-names "${DOMAIN}" \
        --validation-method DNS \
        --region us-east-2 \
        --query 'CertificateArn' \
        --output text)
    
    echo "✅ us-east-2 certificate requested"
    echo "   ARN: $CERT_ARN_EAST2"
    echo ""
    
    sleep 5
    
    echo "📋 DNS Validation Records (SAME for both regions):"
    echo ""
    
    aws acm describe-certificate \
        --certificate-arn "$CERT_ARN_EAST1" \
        --region us-east-1 \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
        --output table
    
    echo ""
    echo "📝 Add this CNAME record to your DNS (validates BOTH certificates):"
    echo ""
    
    RECORD_NAME=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN_EAST1" \
        --region us-east-1 \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Name' \
        --output text)
    
    RECORD_VALUE=$(aws acm describe-certificate \
        --certificate-arn "$CERT_ARN_EAST1" \
        --region us-east-1 \
        --query 'Certificate.DomainValidationOptions[0].ResourceRecord.Value' \
        --output text)
    
    echo "Type:  CNAME"
    echo "Name:  $RECORD_NAME"
    echo "Value: $RECORD_VALUE"
    echo "TTL:   300"
    echo ""
    
    echo "💾 Saving certificate ARNs..."
    cat > infrastructure/terraform/environments/variables/.cert-arns-prod << CERTS
us_east_1_cert_arn="$CERT_ARN_EAST1"
us_east_2_cert_arn="$CERT_ARN_EAST2"
CERTS
    
    echo ""
    echo "✅ Certificate ARNs saved to: infrastructure/terraform/environments/variables/.cert-arns-prod"
    echo ""
    echo "📋 Next steps:"
    echo "1. Add the CNAME record above to your DNS (validates BOTH certificates)"
    echo "2. Wait 5-30 minutes for validation"
    echo "3. Check status: ./scripts/check-certificate-status.sh prod"
    echo "4. Once ISSUED, update prod.tfvars with both ARNs"
fi

echo ""
echo "⏰ Estimated validation time: 5-30 minutes"