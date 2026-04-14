#!/bin/bash

ENV=${1:-dev}

echo "🔍 Checking certificate status for: $ENV"
echo ""

# Support testapp cert file
CERT_FILE="infrastructure/terraform/environments/variables/.cert-arns-$ENV"
if [ "$ENV" == "testapp" ]; then
    CERT_FILE="infrastructure/terraform/environments/variables/.cert-arns-testapp"
fi

if [ ! -f "$CERT_FILE" ]; then
    echo "❌ No certificates found for $ENV"
    echo "   Run: ./scripts/request-certificate-testapp.sh (for testapp)"
    echo "   Or:  ./scripts/request-certificates.sh $ENV (for dev/prod)"
    exit 1
fi

source "$CERT_FILE"

# Use certificate_arn for testapp, us_east_1_cert_arn for dev/prod
CERT_ARN="${certificate_arn:-$us_east_1_cert_arn}"

if [ "$ENV" == "dev" ] || [ "$ENV" == "testapp" ]; then
    echo "📍 us-east-1 Certificate:"
    aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region us-east-1 \
        --query 'Certificate.Status' \
        --output text
else
    echo "📍 us-east-1 Certificate:"
    aws acm describe-certificate \
        --certificate-arn "$us_east_1_cert_arn" \
        --region us-east-1 \
        --query 'Certificate.Status' \
        --output text
    
    echo ""
    echo "📍 us-east-2 Certificate:"
    aws acm describe-certificate \
        --certificate-arn "$us_east_2_cert_arn" \
        --region us-east-2 \
        --query 'Certificate.Status' \
        --output text
fi

echo ""
echo "Status meanings:"
echo "  PENDING_VALIDATION - Waiting for DNS record"
echo "  ISSUED - Ready to use! ✅"
echo "  FAILED - Check DNS records"