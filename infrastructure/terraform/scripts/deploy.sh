#!/bin/bash
set -e

ENVIRONMENT=${1:-dev}
ACTION=${2:-plan}

echo "🚀 CHT Platform Terraform Deployment"
echo "Environment: $ENVIRONMENT"
echo "Action: $ACTION"
echo ""

cd "environments/$ENVIRONMENT"

case $ACTION in
  init)
    echo "📦 Initializing Terraform..."
    terraform init
    ;;
  plan)
    echo "�� Planning Terraform changes..."
    terraform plan
    ;;
  apply)
    echo "🔨 Applying Terraform changes..."
    terraform apply
    ;;
  destroy)
    echo "💥 Destroying infrastructure..."
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      terraform destroy
    else
      echo "Aborted."
    fi
    ;;
  *)
    echo "❌ Unknown action: $ACTION"
    echo "Usage: ./deploy.sh [environment] [init|plan|apply|destroy]"
    exit 1
    ;;
esac

echo ""
echo "✅ Done!"
