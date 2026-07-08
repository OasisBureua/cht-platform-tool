#!/usr/bin/env bash
# Create and start a Cognito CSV import job for platform users.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CSV_FILE="${REPO_ROOT}/data/cognito/platform-users-import.csv"
POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_whXKKxAdX}"
AWS_REGION="${AWS_REGION:-us-east-1}"
IMPORT_ROLE_NAME="${COGNITO_IMPORT_ROLE_NAME:-cognito-import-cloudwatch-role}"
JOB_NAME="platform-users-import-$(date +%Y%m%d-%H%M%S)"

"${SCRIPT_DIR}/cognito-generate-import-csv.sh"

if [ ! -f "$CSV_FILE" ]; then
  echo "CSV not found: $CSV_FILE" >&2
  exit 1
fi

ensure_import_role() {
  if aws iam get-role --role-name "$IMPORT_ROLE_NAME" >/dev/null 2>&1; then
    aws iam get-role --role-name "$IMPORT_ROLE_NAME" --query 'Role.Arn' --output text
    return 0
  fi

  echo "Creating IAM role ${IMPORT_ROLE_NAME} for Cognito import CloudWatch logs..."
  aws iam create-role \
    --role-name "$IMPORT_ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "cognito-idp.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' >/dev/null

  aws iam put-role-policy \
    --role-name "$IMPORT_ROLE_NAME" \
    --policy-name cognito-import-logs \
    --policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Action": [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents"
        ],
        "Resource": "*"
      }]
    }'

  sleep 10
  aws iam get-role --role-name "$IMPORT_ROLE_NAME" --query 'Role.Arn' --output text
}

ROLE_ARN="$(ensure_import_role)"

echo "Creating import job ${JOB_NAME}..."
CREATE_OUT=$(aws cognito-idp create-user-import-job \
  --region "$AWS_REGION" \
  --job-name "$JOB_NAME" \
  --user-pool-id "$POOL_ID" \
  --cloud-watch-logs-role-arn "$ROLE_ARN" \
  --output json)

JOB_ID=$(echo "$CREATE_OUT" | python3 -c "import json,sys; print(json.load(sys.stdin)['UserImportJob']['JobId'])")
PRESIGNED=$(echo "$CREATE_OUT" | python3 -c "import json,sys; print(json.load(sys.stdin)['UserImportJob']['PreSignedUrl'])")

echo "Uploading CSV..."
curl -sS -T "$CSV_FILE" -H "x-amz-server-side-encryption:aws:kms" "$PRESIGNED"

echo "Starting import job ${JOB_ID}..."
aws cognito-idp start-user-import-job \
  --region "$AWS_REGION" \
  --user-pool-id "$POOL_ID" \
  --job-id "$JOB_ID" >/dev/null

echo ""
echo "Import job started: ${JOB_ID}"
echo "Monitor in Console → Cognito → Users → Import jobs, or:"
echo "  aws cognito-idp describe-user-import-job --user-pool-id ${POOL_ID} --job-id ${JOB_ID} --region ${AWS_REGION}"
echo ""
echo "When status is Succeeded, assign groups:"
echo "  ./scripts/cognito-sync-user-groups.sh platform --from-json"
