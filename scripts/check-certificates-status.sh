#!/bin/bash

echo "🔍 Checking ACM Certificate Status"
echo ""

if [ ! -f acm-certificates.txt ]; then
    echo "❌ No certificate file found. Run ./scripts/request-certificates.sh first"
    exit 1
fi

ALB_CERT=$(grep "ALB Certificate ARN:" acm-certificates.txt | cut -d' ' -f4)
CF_CERT=$(grep "CloudFront Certificate ARN:" acm-certificates.txt | cut -d' ' -f4)

echo "📋 ALB Certificate:"
aws acm describe-certificate \
  --certificate-arn $ALB_CERT \
  --region us-east-1 \
  --query 'Certificate.{Status:Status,Domain:DomainName,ValidationStatus:DomainValidationOptions[0].ValidationStatus}' \
  --output table

echo ""
echo "📋 CloudFront Certificate:"
aws acm describe-certificate \
  --certificate-arn $CF_CERT \
  --region us-east-1 \
  --query 'Certificate.{Status:Status,Domain:DomainName,ValidationStatus:DomainValidationOptions[0].ValidationStatus}' \
  --output table

echo ""
echo "✅ Both show 'ISSUED' status? Ready to deploy!"
echo "❌ Still 'PENDING_VALIDATION'? Add DNS records and wait."