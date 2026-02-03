#!/bin/bash

ENV=${1:-dev}

echo "🔍 Checking certificate status for: $ENV"
echo ""

if [ ! -f "infrastructure/terraform/environments/variables/.cert-arns-$ENV" ]; then
    echo "❌ No certificates found for $ENV"
    echo "   Run: ./scripts/request-certificates.sh $ENV"
    exit 1
fi

source infrastructure/terraform/environments/variables/.cert-arns-$ENV

if [ "$ENV" == "dev" ]; then
    echo "📍 us-east-1 Certificate:"
    aws acm describe-certificate \
        --certificate-arn "$us_east_1_cert_arn" \
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