#!/bin/bash

echo "⏳ Waiting for SSL Certificate Validation"
echo "=========================================="
echo ""

if [ ! -f "infrastructure/terraform/environments/variables/.cert-arns-dev" ]; then
    echo "❌ Certificate not requested yet"
    echo "   Run: ./scripts/request-certificates.sh dev"
    exit 1
fi

source infrastructure/terraform/environments/variables/.cert-arns-dev

echo "Certificate ARN: $us_east_1_cert_arn"
echo ""
echo "Checking status every 2 minutes..."
echo "Press Ctrl+C to stop"
echo ""

CHECK_COUNT=0

while true; do
    CHECK_COUNT=$((CHECK_COUNT + 1))
    
    CERT_STATUS=$(aws acm describe-certificate \
        --certificate-arn "$us_east_1_cert_arn" \
        --region us-east-1 \
        --query 'Certificate.Status' \
        --output text 2>/dev/null || echo "ERROR")
    
    TIMESTAMP=$(date '+%H:%M:%S')
    
    if [ "$CERT_STATUS" == "ISSUED" ]; then
        echo ""
        echo "🎉🎉🎉 CERTIFICATE ISSUED! 🎉🎉🎉"
        echo ""
        echo "Next steps:"
        echo "1. Add to GitHub: ./scripts/add-cert-to-github.sh"
        echo "2. Deploy: ./scripts/deploy-primary.sh dev"
        echo ""
        
        # Play sound (macOS)
        afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true
        
        exit 0
    else
        echo "[$TIMESTAMP] Check #$CHECK_COUNT: Status = $CERT_STATUS (waiting...)"
        sleep 120  # Check every 2 minutes
    fi
done
