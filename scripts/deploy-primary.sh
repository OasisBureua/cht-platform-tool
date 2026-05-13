#!/bin/bash
set -e

echo "🚀 CHT Platform - Deploy Primary Region"
echo "========================================"
echo ""

# Check which environment
ENV=${1:-platform}
VAR_FILE="infrastructure/terraform/environments/variables/${ENV}.tfvars"
if [ ! -f "$VAR_FILE" ]; then
    echo "❌ Variable file not found: $VAR_FILE"
    echo "Usage: ./deploy-primary.sh [platform|dev|prod]"
    echo "  platform = single consolidated account (default)"
    exit 1
fi

echo "📦 Environment: $ENV"
echo "📄 Variables: ../variables/${ENV}.tfvars"
echo ""

cd infrastructure/terraform/environments/us-east-1

# Initialize (-reconfigure picks up backend block changes, e.g. S3 use_lockfile)
echo "🔧 Initializing Terraform..."
terraform init -reconfigure

# Validate
echo ""
echo "✅ Validating configuration..."
terraform validate

# Plan
echo ""
echo "📋 Planning deployment..."
terraform plan -var-file="../variables/${ENV}.tfvars" -out=tfplan

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
echo "4. Test: curl https://testapp.communityhealth.media/health/ready"