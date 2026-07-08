#!/bin/bash

ENV=${1:-dev}

echo "🔍 Checking certificate status for: $ENV"
echo ""

CERT_FILE="infrastructure/terraform/environments/variables/.cert-arns-$ENV"
case "$ENV" in
    testapp)
        CERT_FILE="infrastructure/terraform/environments/variables/.cert-arns-testapp"
        ;;
    testapp-use2)
        CERT_FILE="infrastructure/terraform/environments/variables/.cert-arns-testapp-use2"
        ;;
    devapp)
        CERT_FILE="infrastructure/terraform/environments/variables/.cert-arns-devapp"
        ;;
    devapp-use2)
        CERT_FILE="infrastructure/terraform/environments/variables/.cert-arns-devapp-use2"
        ;;
esac

if [ ! -f "$CERT_FILE" ]; then
    echo "❌ No certificates found for $ENV"
    case "$ENV" in
        testapp-use2)
            echo "   Run: ./scripts/request-certificate.sh testapp us-east-2"
            ;;
        testapp)
            echo "   Run: ./scripts/request-certificate.sh testapp"
            ;;
        devapp-use2)
            echo "   Run: ./scripts/request-certificate.sh devapp us-east-2"
            ;;
        devapp)
            echo "   Run: ./scripts/request-certificate.sh devapp"
            ;;
        *)
            echo "   Run the appropriate ./scripts/request-certificate.sh command"
            ;;
    esac
    exit 1
fi

source "$CERT_FILE"

CERT_ARN="${certificate_arn:-$us_east_1_cert_arn}"
CERT_REGION="${region:-us-east-1}"

if [ "$ENV" == "dev" ] || [ "$ENV" == "testapp" ] || [ "$ENV" == "testapp-use2" ] || [ "$ENV" == "devapp" ] || [ "$ENV" == "devapp-use2" ]; then
    echo "📍 $CERT_REGION Certificate:"
    aws acm describe-certificate \
        --certificate-arn "$CERT_ARN" \
        --region "$CERT_REGION" \
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
