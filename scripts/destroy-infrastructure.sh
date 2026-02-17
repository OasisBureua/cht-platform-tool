#!/bin/bash
# Destroy all CHT Platform infrastructure in us-east-1

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

ENV=${1:-platform}
VAR_FILE="infrastructure/terraform/environments/variables/${ENV}.tfvars"

if [ ! -f "$VAR_FILE" ]; then
    echo "❌ Variable file not found: $VAR_FILE"
    echo "Usage: ./scripts/destroy-infrastructure.sh [platform|dev|prod]"
    exit 1
fi

echo "💥 CHT Platform - Destroy Infrastructure"
echo "========================================"
echo ""
echo "⚠️  WARNING: This will DESTROY all infrastructure for $ENV:"
echo "   - VPC, subnets, NAT gateways"
echo "   - RDS database (all data will be lost)"
echo "   - ElastiCache Redis"
echo "   - ECS cluster, tasks, services"
echo "   - ALB, CloudFront, S3 buckets"
echo "   - Route53 records, SQS queues, etc."
echo ""
read -p "Type 'destroy' to confirm: " CONFIRM
if [ "$CONFIRM" != "destroy" ]; then
    echo "❌ Cancelled. No resources destroyed."
    exit 0
fi

echo ""
cd infrastructure/terraform/environments/us-east-1

echo "🔧 Initializing Terraform..."
terraform init -input=false

echo ""
echo "💥 Destroying infrastructure..."
echo ""
echo "If destroy fails (ALB/RDS deletion protection), temporarily disable in the modules,"
echo "run 'terraform apply', then run this script again."
echo ""
terraform destroy -var-file="../variables/${ENV}.tfvars" -auto-approve

echo ""
echo "✅ Infrastructure destroyed."
echo ""
echo "Note: Terraform state bucket (cht-platform-terraform-state) and DynamoDB lock table"
echo "      are NOT destroyed. Delete manually if desired:"
echo "      aws s3 rb s3://cht-platform-terraform-state --force"
echo "      aws dynamodb delete-table --table-name cht-platform-terraform-locks"
