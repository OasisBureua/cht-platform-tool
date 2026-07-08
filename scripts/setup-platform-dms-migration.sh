#!/usr/bin/env bash
# Provision AWS DMS for platform RDS -> Aurora Global primary migration (full load + CDC).
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
PROJECT="cht-platform"
VPC_ID="vpc-034141e3292f1f3fb"
PRIVATE_SUBNETS="subnet-034ae4696445bb08b subnet-0726a87cd7adfc9b2"
RDS_SG="sg-0d0872933abf60871"
AURORA_SG="sg-070390e4ff833b9e3"
RDS_PARAM_GROUP="cht-platform-platform-postgres"
RDS_INSTANCE="cht-platform-db"
SOURCE_SECRET="cht-platform-database-credentials"
TARGET_SECRET="cht-platform-aurora-database-credentials"
DMS_SOURCE_SECRET="${PROJECT}-dms-source-credentials"
DMS_TARGET_SECRET="${PROJECT}-dms-target-credentials"
DMS_SECRETS_ROLE="dms-secrets-access-role"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
DMS_SG_NAME="${PROJECT}-dms-sg"
DMS_SUBNET_GROUP="${PROJECT}-dms-subnet"
DMS_INSTANCE="${PROJECT}-dms"
SOURCE_ENDPOINT="${PROJECT}-rds-source"
TARGET_ENDPOINT="${PROJECT}-aurora-target"
REPLICATION_TASK="${PROJECT}-rds-to-aurora"

log() { printf '==> %s\n' "$*"; }

ensure_dms_iam_roles() {
  if ! aws iam get-role --role-name dms-vpc-role >/dev/null 2>&1; then
    log "Creating IAM role dms-vpc-role"
    aws iam create-role \
      --role-name dms-vpc-role \
      --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Principal": {"Service": "dms.amazonaws.com"},
          "Action": "sts:AssumeRole"
        }]
      }' >/dev/null
    aws iam attach-role-policy \
      --role-name dms-vpc-role \
      --policy-arn arn:aws:iam::aws:policy/service-role/AmazonDMSVPCManagementRole
  fi

  if ! aws iam get-role --role-name dms-cloudwatch-logs-role >/dev/null 2>&1; then
    log "Creating IAM role dms-cloudwatch-logs-role"
    aws iam create-role \
      --role-name dms-cloudwatch-logs-role \
      --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [{
          "Effect": "Allow",
          "Principal": {"Service": "dms.amazonaws.com"},
          "Action": "sts:AssumeRole"
        }]
      }' >/dev/null
    aws iam attach-role-policy \
      --role-name dms-cloudwatch-logs-role \
      --policy-arn arn:aws:iam::aws:policy/service-role/AmazonDMSCloudWatchLogsRole
  fi

  if ! aws iam get-role --role-name "$DMS_SECRETS_ROLE" >/dev/null 2>&1; then
    log "Creating IAM role ${DMS_SECRETS_ROLE}"
    aws iam create-role \
      --role-name "$DMS_SECRETS_ROLE" \
      --assume-role-policy-document "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [{
          \"Effect\": \"Allow\",
          \"Principal\": {
            \"Service\": [
              \"dms.amazonaws.com\",
              \"dms.${REGION}.amazonaws.com\"
            ]
          },
          \"Action\": \"sts:AssumeRole\"
        }]
      }" >/dev/null
    aws iam put-role-policy \
      --role-name "$DMS_SECRETS_ROLE" \
      --policy-name dms-secrets-read \
      --policy-document "{
        \"Version\": \"2012-10-17\",
        \"Statement\": [{
          \"Effect\": \"Allow\",
          \"Action\": [\"secretsmanager:GetSecretValue\", \"secretsmanager:DescribeSecret\"],
          \"Resource\": [
            \"arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:${DMS_SOURCE_SECRET}*\",
            \"arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:${DMS_TARGET_SECRET}*\"
          ]
        }]
      }"
  fi
}

ensure_dms_security_group() {
  local sg_id
  sg_id="$(aws ec2 describe-security-groups \
    --region "$REGION" \
    --filters "Name=group-name,Values=${DMS_SG_NAME}" "Name=vpc-id,Values=${VPC_ID}" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || true)"

  if [[ -z "$sg_id" || "$sg_id" == "None" ]]; then
    log "Creating DMS security group ${DMS_SG_NAME}"
    sg_id="$(aws ec2 create-security-group \
      --region "$REGION" \
      --group-name "$DMS_SG_NAME" \
      --description "DMS replication instance for platform Aurora migration" \
      --vpc-id "$VPC_ID" \
      --query 'GroupId' \
      --output text)"
    aws ec2 create-tags --region "$REGION" --resources "$sg_id" \
      --tags "Key=Name,Value=${DMS_SG_NAME}" "Key=Project,Value=${PROJECT}"
  fi

  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$RDS_SG" \
    --protocol tcp \
    --port 5432 \
    --source-group "$sg_id" 2>/dev/null || true

  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$AURORA_SG" \
    --protocol tcp \
    --port 5432 \
    --source-group "$sg_id" 2>/dev/null || true

  echo "$sg_id"
}

ensure_replication_subnet_group() {
  if aws dms describe-replication-subnet-groups \
    --region "$REGION" \
    --filters "Name=replication-subnet-group-id,Values=${DMS_SUBNET_GROUP}" \
    --query 'ReplicationSubnetGroups[0].ReplicationSubnetGroupIdentifier' \
    --output text 2>/dev/null | grep -q "$DMS_SUBNET_GROUP"; then
    return 0
  fi

  log "Creating DMS subnet group ${DMS_SUBNET_GROUP}"
  aws dms create-replication-subnet-group \
    --region "$REGION" \
    --replication-subnet-group-identifier "$DMS_SUBNET_GROUP" \
    --replication-subnet-group-description "Platform DMS subnets" \
    --subnet-ids $PRIVATE_SUBNETS \
    --tags "Key=Project,Value=${PROJECT}" >/dev/null
}

ensure_replication_instance() {
  local sg_id="$1"
  local status
  status="$(aws dms describe-replication-instances \
    --region "$REGION" \
    --filters "Name=replication-instance-id,Values=${DMS_INSTANCE}" \
    --query 'ReplicationInstances[0].ReplicationInstanceStatus' \
    --output text 2>/dev/null || true)"

  if [[ -z "$status" || "$status" == "None" ]]; then
    log "Creating DMS replication instance ${DMS_INSTANCE} (dms.t3.medium)"
    aws dms create-replication-instance \
      --region "$REGION" \
      --replication-instance-identifier "$DMS_INSTANCE" \
      --replication-instance-class dms.t3.medium \
      --allocated-storage 50 \
      --vpc-security-group-ids "$sg_id" \
      --replication-subnet-group-identifier "$DMS_SUBNET_GROUP" \
      --no-publicly-accessible \
      --no-multi-az \
      --engine-version 3.5.4 \
      --tags "Key=Project,Value=${PROJECT}" >/dev/null
    return 0
  fi

  log "DMS replication instance status: ${status}"
}

enable_logical_replication() {
  local current
  current="$(aws rds describe-db-parameters \
    --region "$REGION" \
    --db-parameter-group-name "$RDS_PARAM_GROUP" \
    --query "Parameters[?ParameterName=='rds.logical_replication'].ParameterValue | [0]" \
    --output text)"

  if [[ "$current" != "1" ]]; then
    log "Enabling rds.logical_replication on ${RDS_PARAM_GROUP}"
    aws rds modify-db-parameter-group \
      --region "$REGION" \
      --db-parameter-group-name "$RDS_PARAM_GROUP" \
      --parameters "ParameterName=rds.logical_replication,ParameterValue=1,ApplyMethod=pending-reboot" >/dev/null
  fi

  local param_status rds_status
  param_status="$(aws rds describe-db-instances \
    --region "$REGION" \
    --db-instance-identifier "$RDS_INSTANCE" \
    --query 'DBInstances[0].DBParameterGroups[0].ParameterApplyStatus' \
    --output text)"
  rds_status="$(aws rds describe-db-instances \
    --region "$REGION" \
    --db-instance-identifier "$RDS_INSTANCE" \
    --query 'DBInstances[0].DBInstanceStatus' \
    --output text)"

  if [[ "$param_status" == "pending-reboot" && "$rds_status" == "available" ]]; then
    log "Rebooting ${RDS_INSTANCE} to apply logical replication (brief downtime)"
    aws rds reboot-db-instance \
      --region "$REGION" \
      --db-instance-identifier "$RDS_INSTANCE" >/dev/null
  fi
}

read_secret_field() {
  local secret_id="$1"
  local field="$2"
  aws secretsmanager get-secret-value \
    --region "$REGION" \
    --secret-id "$secret_id" \
    --query SecretString \
    --output text | python3 -c "import json,sys; print(json.load(sys.stdin)['$field'])"
}

normalize_host() {
  local host="$1"
  echo "${host%%:*}"
}

ensure_dms_secrets() {
  local secrets_role_arn
  secrets_role_arn="arn:aws:iam::${ACCOUNT_ID}:role/${DMS_SECRETS_ROLE}"

  python3 <<PY
import json, subprocess

def load(secret_id):
    out = subprocess.check_output([
        "aws", "secretsmanager", "get-secret-value",
        "--region", "${REGION}",
        "--secret-id", secret_id,
        "--query", "SecretString",
        "--output", "text",
    ], text=True)
    return json.loads(out)

def normalize_host(host):
    return host.split(":")[0]

def dms_payload(src, engine):
    host = normalize_host(src.get("host", ""))
    port = int(src.get("port", 5432))
    return {
        "engine": engine,
        "host": host,
        "port": port,
        "username": src["username"],
        "password": src["password"],
        "dbname": src["dbname"],
    }

source = dms_payload(load("${SOURCE_SECRET}"), "postgres")
target = dms_payload(load("${TARGET_SECRET}"), "postgres")

for secret_id, payload in [
    ("${DMS_SOURCE_SECRET}", source),
    ("${DMS_TARGET_SECRET}", target),
]:
    try:
        subprocess.check_call([
            "aws", "secretsmanager", "describe-secret",
            "--region", "${REGION}",
            "--secret-id", secret_id,
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        subprocess.check_call([
            "aws", "secretsmanager", "create-secret",
            "--region", "${REGION}",
            "--name", secret_id,
            "--description", "DMS endpoint credentials for platform Aurora migration",
            "--secret-string", json.dumps(payload),
        ])
PY

  echo "$secrets_role_arn"
}

ensure_endpoints() {
  local secrets_role_arn="$1"
  local pg_settings aurora_settings

  pg_settings="$(SECRETS_ROLE_ARN="$secrets_role_arn" python3 - <<'PY'
import json, os
print(json.dumps({
    "SecretsManagerSecretId": "cht-platform-dms-source-credentials",
    "SecretsManagerAccessRoleArn": os.environ["SECRETS_ROLE_ARN"],
}))
PY
)"
  aurora_settings="$(SECRETS_ROLE_ARN="$secrets_role_arn" python3 - <<'PY'
import json, os
print(json.dumps({
    "SecretsManagerSecretId": "cht-platform-dms-target-credentials",
    "SecretsManagerAccessRoleArn": os.environ["SECRETS_ROLE_ARN"],
}))
PY
)"

  if ! aws dms describe-endpoints \
    --region "$REGION" \
    --filters "Name=endpoint-id,Values=${SOURCE_ENDPOINT}" \
    --query 'Endpoints[0].EndpointIdentifier' \
    --output text 2>/dev/null | grep -q "$SOURCE_ENDPOINT"; then
    log "Creating DMS source endpoint ${SOURCE_ENDPOINT}"
    aws dms create-endpoint \
      --region "$REGION" \
      --endpoint-identifier "$SOURCE_ENDPOINT" \
      --endpoint-type source \
      --engine-name postgres \
      --database-name cht_platform \
      --postgre-sql-settings "$pg_settings" \
      --tags "Key=Project,Value=${PROJECT}" >/dev/null
  fi

  if ! aws dms describe-endpoints \
    --region "$REGION" \
    --filters "Name=endpoint-id,Values=${TARGET_ENDPOINT}" \
    --query 'Endpoints[0].EndpointIdentifier' \
    --output text 2>/dev/null | grep -q "$TARGET_ENDPOINT"; then
    log "Creating DMS target endpoint ${TARGET_ENDPOINT}"
    aws dms create-endpoint \
      --region "$REGION" \
      --endpoint-identifier "$TARGET_ENDPOINT" \
      --endpoint-type target \
      --engine-name aurora-postgresql \
      --database-name cht_platform \
      --postgre-sql-settings "$aurora_settings" \
      --tags "Key=Project,Value=${PROJECT}" >/dev/null
  fi
}

ensure_replication_task() {
  local rep_arn source_arn target_arn
  rep_arn="$(aws dms describe-replication-instances \
    --region "$REGION" \
    --filters "Name=replication-instance-id,Values=${DMS_INSTANCE}" \
    --query 'ReplicationInstances[0].ReplicationInstanceArn' \
    --output text)"
  source_arn="$(aws dms describe-endpoints \
    --region "$REGION" \
    --filters "Name=endpoint-id,Values=${SOURCE_ENDPOINT}" \
    --query 'Endpoints[0].EndpointArn' \
    --output text)"
  target_arn="$(aws dms describe-endpoints \
    --region "$REGION" \
    --filters "Name=endpoint-id,Values=${TARGET_ENDPOINT}" \
    --query 'Endpoints[0].EndpointArn' \
    --output text)"

  if aws dms describe-replication-tasks \
    --region "$REGION" \
    --filters "Name=replication-task-id,Values=${REPLICATION_TASK}" \
    --query 'ReplicationTasks[0].ReplicationTaskIdentifier' \
    --output text 2>/dev/null | grep -q "$REPLICATION_TASK"; then
    log "Replication task ${REPLICATION_TASK} already exists"
    return 0
  fi

  local table_mappings task_settings
  table_mappings='{"rules":[{"rule-type":"selection","rule-id":"1","rule-name":"public-all","object-locator":{"schema-name":"public","table-name":"%"},"rule-action":"include"}]}'
  task_settings='{"TargetMetadata":{"TargetSchema":"","SupportLobs":true,"FullLobMode":false,"LobChunkSize":64,"LimitedSizeLobMode":true,"LobMaxSize":32},"FullLoadSettings":{"TargetTablePrepMode":"TRUNCATE_BEFORE_LOAD","MaxFullLoadSubTasks":8},"Logging":{"EnableLogging":true}}'

  log "Creating replication task ${REPLICATION_TASK} (full-load-and-cdc)"
  aws dms create-replication-task \
    --region "$REGION" \
    --replication-task-identifier "$REPLICATION_TASK" \
    --source-endpoint-arn "$source_arn" \
    --target-endpoint-arn "$target_arn" \
    --replication-instance-arn "$rep_arn" \
    --migration-type full-load-and-cdc \
    --table-mappings "$table_mappings" \
    --replication-task-settings "$task_settings" \
    --tags "Key=Project,Value=${PROJECT}" >/dev/null
}

start_replication_task() {
  local task_arn status
  task_arn="$(aws dms describe-replication-tasks \
    --region "$REGION" \
    --filters "Name=replication-task-id,Values=${REPLICATION_TASK}" \
    --query 'ReplicationTasks[0].ReplicationTaskArn' \
    --output text)"
  status="$(aws dms describe-replication-tasks \
    --region "$REGION" \
    --filters "Name=replication-task-id,Values=${REPLICATION_TASK}" \
    --query 'ReplicationTasks[0].Status' \
    --output text)"

  if [[ "$status" == "ready" ]]; then
    log "Starting replication task ${REPLICATION_TASK}"
    aws dms start-replication-task \
      --region "$REGION" \
      --replication-task-arn "$task_arn" \
      --start-replication-task-type start-replication >/dev/null
  else
    log "Replication task status: ${status}"
  fi
}

main() {
  ensure_dms_iam_roles
  local dms_sg
  dms_sg="$(ensure_dms_security_group)"
  ensure_replication_subnet_group
  ensure_replication_instance "$dms_sg"
  enable_logical_replication

  local rep_status
  rep_status="$(aws dms describe-replication-instances \
    --region "$REGION" \
    --filters "Name=replication-instance-id,Values=${DMS_INSTANCE}" \
    --query 'ReplicationInstances[0].ReplicationInstanceStatus' \
    --output text 2>/dev/null || true)"

  if [[ "$rep_status" != "available" ]]; then
    log "Waiting for DMS instance (current: ${rep_status:-creating}). Re-run with --wait then --start."
    exit 0
  fi

  local secrets_role_arn
  secrets_role_arn="$(ensure_dms_secrets)"
  ensure_endpoints "$secrets_role_arn"
  ensure_replication_task

  if [[ "${1:-}" == "--start" ]]; then
    start_replication_task
  fi

  log "Done. Monitor: aws dms describe-replication-tasks --region ${REGION} --filters Name=replication-task-id,Values=${REPLICATION_TASK}"
}

main "$@"
