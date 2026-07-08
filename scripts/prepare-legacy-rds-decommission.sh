#!/bin/bash
# Disable deletion protection (and expand storage-full primaries) before Terraform
# destroys legacy RDS after Aurora Global cutover.
set -euo pipefail

REGION=${1:?Usage: prepare-legacy-rds-decommission.sh <us-east-1|us-east-2> <platform|dev>}
ENV=${2:?Usage: prepare-legacy-rds-decommission.sh <us-east-1|us-east-2> <platform|dev>}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/${ENV}.tfvars"

if [ ! -f "$VAR_FILE" ]; then
  echo "❌ Variable file not found: $VAR_FILE"
  exit 1
fi

read_tfvar() {
  grep -E "^${1}[[:space:]]*=" "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/'
}

read_tfvar_bool() {
  local value
  value=$(grep -E "^${1}[[:space:]]*=" "$VAR_FILE" | head -1 | sed -E 's/^[^=]*=[[:space:]]*//' | tr '[:upper:]' '[:lower:]' | tr -d ' ' || true)
  echo "${value:-false}"
}

PROJECT=$(read_tfvar project)
PROJECT=${PROJECT:-cht-platform}

DECOMMISSION=$(read_tfvar_bool decommission_rds)
ENABLE_AURORA=$(read_tfvar_bool enable_aurora_global)

if [ "$DECOMMISSION" != "true" ] || [ "$ENABLE_AURORA" != "true" ]; then
  exit 0
fi

case "$ENV" in
  platform)
    PRIMARY_ID="${PROJECT}-db"
    REPLICA_ID="${PROJECT}-dr-use2-db-replica"
    ;;
  dev)
    PRIMARY_ID="${PROJECT}-dev-db"
    REPLICA_ID="${PROJECT}-dr-use2-dev-db-replica"
    ;;
  *)
    echo "❌ Unknown environment: $ENV"
    exit 1
    ;;
esac

disable_deletion_protection() {
  local id=$1
  local region=$2

  if ! aws rds describe-db-instances --db-instance-identifier "$id" --region "$region" >/dev/null 2>&1; then
    return 0
  fi

  local protected
  protected=$(aws rds describe-db-instances \
    --db-instance-identifier "$id" \
    --region "$region" \
    --query 'DBInstances[0].DeletionProtection' \
    --output text)

  if [ "$protected" = "True" ] || [ "$protected" = "true" ]; then
    echo "🔓 Disabling deletion protection on $id ($region)..."
    aws rds modify-db-instance \
      --db-instance-identifier "$id" \
      --no-deletion-protection \
      --apply-immediately \
      --region "$region"
    aws rds wait db-instance-available --db-instance-identifier "$id" --region "$region"
  fi
}

ensure_available_for_final_snapshot() {
  local id=$1
  local region=$2

  if ! aws rds describe-db-instances --db-instance-identifier "$id" --region "$region" >/dev/null 2>&1; then
    return 0
  fi

  local status allocated
  status=$(aws rds describe-db-instances \
    --db-instance-identifier "$id" \
    --region "$region" \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text)
  allocated=$(aws rds describe-db-instances \
    --db-instance-identifier "$id" \
    --region "$region" \
    --query 'DBInstances[0].AllocatedStorage' \
    --output text)

  if [ "$status" = "storage-full" ]; then
    local target=$((allocated + 30))
    if [ "$target" -lt 50 ]; then
      target=50
    fi
    echo "💾 Expanding $id storage ${allocated}GiB → ${target}GiB ($region)..."
    aws rds modify-db-instance \
      --db-instance-identifier "$id" \
      --allocated-storage "$target" \
      --apply-immediately \
      --region "$region"
    aws rds wait db-instance-available --db-instance-identifier "$id" --region "$region"
  fi
}

case "$REGION" in
  us-east-2)
    # Replica may still exist in AWS even when enable_db_replica is omitted from tfvars (default true).
    disable_deletion_protection "$REPLICA_ID" "us-east-2"
    ;;
  us-east-1)
    ensure_available_for_final_snapshot "$PRIMARY_ID" "us-east-1"
    disable_deletion_protection "$PRIMARY_ID" "us-east-1"
    ;;
  *)
    echo "❌ Unknown region: $REGION"
    exit 1
    ;;
esac
