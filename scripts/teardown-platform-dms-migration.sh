#!/bin/bash
# Tear down AWS DMS resources for platform RDS -> Aurora migration.
# Safe after cutover: app uses Aurora; DMS task already stopped.
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT:-cht-platform}"

REPLICATION_TASK="${PROJECT}-rds-to-aurora"
SOURCE_ENDPOINT="${PROJECT}-rds-source"
TARGET_ENDPOINT="${PROJECT}-aurora-target"
DMS_INSTANCE="${PROJECT}-dms"
DMS_SUBNET_GROUP="${PROJECT}-dms-subnet"
DMS_SOURCE_SECRET="${PROJECT}-dms-source-credentials"
DMS_TARGET_SECRET="${PROJECT}-dms-target-credentials"

log() { echo "[dms-teardown] $*"; }

wait_replication_instance_gone() {
  local tries=0
  while aws dms describe-replication-instances \
    --region "$REGION" \
    --filters "Name=replication-instance-id,Values=${DMS_INSTANCE}" \
    --query 'ReplicationInstances[0].ReplicationInstanceStatus' \
    --output text 2>/dev/null | grep -qvE 'None|^$'; do
    tries=$((tries + 1))
    if [ "$tries" -gt 60 ]; then
      log "Timed out waiting for replication instance deletion"
      exit 1
    fi
    sleep 15
  done
}

delete_replication_task() {
  local task_arn status
  task_arn="$(aws dms describe-replication-tasks \
    --region "$REGION" \
    --filters "Name=replication-task-id,Values=${REPLICATION_TASK}" \
    --query 'ReplicationTasks[0].ReplicationTaskArn' \
    --output text 2>/dev/null || true)"
  if [ -z "$task_arn" ] || [ "$task_arn" = "None" ]; then
    log "Replication task not found (skip)"
    return
  fi
  status="$(aws dms describe-replication-tasks \
    --region "$REGION" \
    --filters "Name=replication-task-id,Values=${REPLICATION_TASK}" \
    --query 'ReplicationTasks[0].Status' \
    --output text)"
  if [ "$status" != "stopped" ] && [ "$status" != "failed" ] && [ "$status" != "ready" ]; then
    log "Stopping replication task (${status})..."
    aws dms stop-replication-task \
      --region "$REGION" \
      --replication-task-arn "$task_arn" >/dev/null
    sleep 10
  fi
  log "Deleting replication task ${REPLICATION_TASK}"
  aws dms delete-replication-task \
    --region "$REGION" \
    --replication-task-arn "$task_arn" >/dev/null
  local tries=0
  while aws dms describe-replication-tasks \
    --region "$REGION" \
    --filters "Name=replication-task-id,Values=${REPLICATION_TASK}" \
    --query 'ReplicationTasks[0].ReplicationTaskArn' \
    --output text 2>/dev/null | grep -qvE 'None|^$'; do
    tries=$((tries + 1))
    if [ "$tries" -gt 40 ]; then
      log "Timed out waiting for replication task deletion"
      exit 1
    fi
    sleep 10
  done
}

delete_endpoint() {
  local id="$1"
  local arn
  arn="$(aws dms describe-endpoints \
    --region "$REGION" \
    --filters "Name=endpoint-id,Values=${id}" \
    --query 'Endpoints[0].EndpointArn' \
    --output text 2>/dev/null || true)"
  if [ -z "$arn" ] || [ "$arn" = "None" ]; then
    log "Endpoint ${id} not found (skip)"
    return
  fi
  log "Deleting endpoint ${id}"
  aws dms delete-endpoint --region "$REGION" --endpoint-arn "$arn" >/dev/null
}

delete_replication_instance() {
  local arn status
  arn="$(aws dms describe-replication-instances \
    --region "$REGION" \
    --filters "Name=replication-instance-id,Values=${DMS_INSTANCE}" \
    --query 'ReplicationInstances[0].ReplicationInstanceArn' \
    --output text 2>/dev/null || true)"
  if [ -z "$arn" ] || [ "$arn" = "None" ]; then
    log "Replication instance not found (skip)"
    return
  fi
  status="$(aws dms describe-replication-instances \
    --region "$REGION" \
    --filters "Name=replication-instance-id,Values=${DMS_INSTANCE}" \
    --query 'ReplicationInstances[0].ReplicationInstanceStatus' \
    --output text)"
  log "Deleting replication instance ${DMS_INSTANCE} (status: ${status})"
  aws dms delete-replication-instance \
    --region "$REGION" \
    --replication-instance-arn "$arn" >/dev/null
  wait_replication_instance_gone
}

delete_subnet_group() {
  if aws dms describe-replication-subnet-groups \
    --region "$REGION" \
    --filters "Name=replication-subnet-group-id,Values=${DMS_SUBNET_GROUP}" \
    --query 'ReplicationSubnetGroups[0].ReplicationSubnetGroupIdentifier' \
    --output text 2>/dev/null | grep -q "$DMS_SUBNET_GROUP"; then
    log "Deleting subnet group ${DMS_SUBNET_GROUP}"
    aws dms delete-replication-subnet-group \
      --region "$REGION" \
      --replication-subnet-group-identifier "$DMS_SUBNET_GROUP" >/dev/null
  else
    log "Subnet group not found (skip)"
  fi
}

delete_secret() {
  local name="$1"
  if aws secretsmanager describe-secret --secret-id "$name" --region "$REGION" >/dev/null 2>&1; then
    log "Deleting secret ${name}"
    aws secretsmanager delete-secret \
      --secret-id "$name" \
      --region "$REGION" \
      --force-delete-without-recovery >/dev/null
  fi
}

log "Starting DMS teardown in ${REGION} for ${PROJECT}"
delete_replication_task
delete_endpoint "$SOURCE_ENDPOINT"
delete_endpoint "$TARGET_ENDPOINT"
delete_replication_instance
delete_subnet_group
delete_secret "$DMS_SOURCE_SECRET"
delete_secret "$DMS_TARGET_SECRET"
log "Done. IAM roles (dms-vpc-role, dms-cloudwatch-logs-role, dms-secrets-access-role) left in place."
