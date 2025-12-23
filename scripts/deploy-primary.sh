#!/bin/bash
set -e

echo "🚀 CHT Platform - Deploy Primary Region"
echo "========================================"
echo ""

# Check which environment
if [ -z "$1" ]; then
    echo "Usage: ./deploy-primary.sh [dev|prod]"
    exit 1
fi

ENV=$1
VAR_FILE="environments/variables/${ENV}.tfvars"

if [ ! -f "infrastructure/terraform/$VAR_FILE" ]; then
    echo "❌ Variable file not found: $VAR_FILE"
    exit 1
fi

echo "📦 Environment: $ENV"
echo "📄 Variables: $VAR_FILE"
echo ""

cd infrastructure/terraform/environments/us-east-1

# Initialize
echo "🔧 Initializing Terraform..."
terraform init

# Validate
echo ""
echo "✅ Validating configuration..."
terraform validate

# Plan
echo ""
echo "📋 Planning deployment..."
terraform plan -var-file="../$VAR_FILE" -out=tfplan

# Show plan summary
echo ""
echo "📊 Plan Summary:"
terraform show -json tfplan | jq -r '.resource_changes[] | select(.change.actions != ["no-op"]) | "\(.change.actions[0]): \(.type).\(.name)"'
echo ""

# Confirm
read -p "Deploy to us-east-1 ($ENV)? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deployment cancelled."
    rm tfplan
    exit 0
fi

# Apply
echo ""
echo "🚀 Deploying infrastructure..."
terraform apply tfplan
rm tfplan

echo ""
echo "✅ us-east-1 ($ENV) deployed successfully!"
echo ""

# Show outputs
echo "📋 Deployment Outputs:"
terraform output

# Save outputs to file
echo ""
echo "💾 Saving outputs to us-east-1-outputs.txt..."
terraform output > ~/cht-us-east-1-$ENV-outputs.txt

echo ""
echo "📋 Next steps:"
echo "1. Add Route53 NS records to your DNS provider"
echo "2. Deploy frontend: ./deploy-frontend.sh $ENV"
echo "3. Run database migrations: ./run-migrations.sh $ENV"
echo "4. Test: curl https://api.communityhealth.media/health/ready"