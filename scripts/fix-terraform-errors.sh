#!/bin/bash
# Fix common Terraform deployment errors:
# 1. RDS PostgreSQL version - updated in modules/database/rds/variables.tf to 15.10
# 2. CloudWatch log group already exists - import into Terraform state
# 3. Secrets scheduled for deletion - restore them first

set -e

ENV=${1:-platform}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$PROJECT_ROOT/infrastructure/terraform/environments/us-east-1"

echo "🔧 Fix Terraform Deployment Errors"
echo "=================================="
echo "Environment: $ENV"
echo ""

# 1. Restore Secrets Manager secrets (if scheduled for deletion)
SECRET_PREFIX=$([ "$ENV" == "platform" ] && echo "cht-platform" || echo "cht-platform-${ENV}")
echo "1️⃣  Restoring Secrets Manager secrets (if scheduled for deletion)..."
for SECRET in ${SECRET_PREFIX}-database-credentials ${SECRET_PREFIX}-redis-connection ${SECRET_PREFIX}-app-secrets; do
  echo "   Trying $SECRET..."
  aws secretsmanager restore-secret --secret-id "$SECRET" 2>/dev/null && echo "     Restored" || echo "     (Skip - not in deletion state or doesn't exist)"
done
echo "   Done"
echo ""

# 2. Import CloudWatch log group if it exists
LOG_GROUP="/aws/vpc/${SECRET_PREFIX}-flow-logs"
if aws logs describe-log-groups --log-group-name-prefix "$LOG_GROUP" --query "logGroups[?logGroupName=='$LOG_GROUP']" --output text 2>/dev/null | grep -q .; then
  echo "2️⃣  Importing existing CloudWatch log group..."
  cd "$TF_DIR"
  terraform import -var-file="../variables/${ENV}.tfvars" "module.vpc.aws_cloudwatch_log_group.flow_logs[0]" "$LOG_GROUP" 2>/dev/null || echo "   (Already in state or import failed)"
  cd "$PROJECT_ROOT"
  echo "   Done"
else
  echo "2️⃣  CloudWatch log group doesn't exist - Terraform will create it"
fi
echo ""

# 3. Import Secrets Manager secrets (they exist but Terraform state doesn't have them)
echo "3️⃣  Importing existing Secrets Manager secrets..."
cd "$TF_DIR"
terraform import -var-file="../variables/${ENV}.tfvars" "module.secrets.aws_secretsmanager_secret.database" "${SECRET_PREFIX}-database-credentials" 2>/dev/null && echo "   database: imported" || echo "   database: skip (not in AWS or already in state)"
terraform import -var-file="../variables/${ENV}.tfvars" "module.secrets.aws_secretsmanager_secret.redis" "${SECRET_PREFIX}-redis-connection" 2>/dev/null && echo "   redis: imported" || echo "   redis: skip"
terraform import -var-file="../variables/${ENV}.tfvars" "module.secrets.aws_secretsmanager_secret.app_secrets" "${SECRET_PREFIX}-app-secrets" 2>/dev/null && echo "   app-secrets: imported" || echo "   app-secrets: skip"
cd "$PROJECT_ROOT"
echo "   Done"
echo ""

echo "✅ Run terraform apply again:"
echo "   cd $TF_DIR"
echo "   terraform apply -var-file=\"../variables/${ENV}.tfvars\""
echo ""
echo "   Or: ./scripts/deploy-primary.sh $ENV"
