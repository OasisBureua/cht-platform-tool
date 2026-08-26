#!/bin/bash
# Apply Cognito user pool settings that Terraform cannot manage on MRR-enabled pools.
#
# When multi-Region replication is enabled, UpdateUserPool must include KeyConfiguration
# (customer-managed KMS). AWS provider 5.x omits that field, so deploy-primary.sh calls
# this script after terraform apply instead of updating the pool in Terraform.
#
# Usage:
#   ./scripts/cognito-sync-pool-config.sh dev
#
set -euo pipefail

ENV="${1:-dev}"
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$REPO_ROOT/infrastructure/terraform/environments/us-east-1"
BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-1-${ENV}.hcl"
VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/${ENV}.tfvars"

if [ ! -f "$VAR_FILE" ]; then
  echo "❌ Variable file not found: $VAR_FILE"
  exit 1
fi

read_tfvar() {
  grep -E "^${1}[[:space:]]*=" "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/'
}

read_tfvar_bool() {
  grep -E "^${1}[[:space:]]*=" "$VAR_FILE" | head -1 | sed -E 's/^[^=]*=[[:space:]]*//' | tr '[:upper:]' '[:lower:]'
}

ENABLE_MRR=$(read_tfvar_bool enable_cognito_mrr)
EMAIL_ACCOUNT=$(read_tfvar cognito_email_sending_account)

if [ "$ENABLE_MRR" != "true" ] && [ "$EMAIL_ACCOUNT" != "DEVELOPER" ]; then
  echo "ℹ️  No Cognito pool sync needed (MRR off and email not DEVELOPER)."
  exit 0
fi

cd "$TF_DIR"
terraform init -input=false -reconfigure -backend-config="$BACKEND_CONFIG" >/dev/null
USER_POOL_ID=$(terraform output -raw cognito_user_pool_id 2>/dev/null || true)
KMS_KEY_ARN=$(terraform output -raw cognito_kms_key_arn 2>/dev/null || true)
cd "$REPO_ROOT"

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" = "null" ]; then
  echo "❌ Cognito user pool ID not found in Terraform outputs."
  exit 1
fi

if [ -z "$KMS_KEY_ARN" ] || [ "$KMS_KEY_ARN" = "null" ]; then
  if [ "$ENABLE_MRR" = "true" ]; then
    echo "❌ Cognito KMS key ARN not found. Set enable_cognito_mrr = true and apply first."
    exit 1
  fi
  KMS_KEY_ARN=""
fi

EMAIL_FROM=$(read_tfvar cognito_email_from)
EMAIL_REPLY=$(read_tfvar cognito_email_reply_to)
VERIFY_SUBJECT=$(grep -E '^cognito_verification_email_subject[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/' || true)
VERIFY_MESSAGE=$(grep -E '^cognito_verification_email_message[[:space:]]*=' "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/' || true)

if [ -z "$VERIFY_SUBJECT" ]; then
  VERIFY_SUBJECT="Verify your Community Health account"
fi
if [ -z "$VERIFY_MESSAGE" ]; then
  VERIFY_MESSAGE="Your verification code is {####}."
fi

echo "🔐 Syncing Cognito pool config (MRR-safe API)"
echo "   Pool: $USER_POOL_ID"
if [ -n "$KMS_KEY_ARN" ]; then
  echo "   KMS:  $KMS_KEY_ARN"
fi
echo ""

export USER_POOL_ID KMS_KEY_ARN PRIMARY_REGION EMAIL_ACCOUNT EMAIL_FROM EMAIL_REPLY VERIFY_SUBJECT VERIFY_MESSAGE ENABLE_MRR

python3 <<'PY'
import json
import os
import sys

import botocore.session
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
import urllib3

pool_id = os.environ["USER_POOL_ID"]
region = os.environ["PRIMARY_REGION"]
kms_arn = os.environ.get("KMS_KEY_ARN", "")
email_account = os.environ.get("EMAIL_ACCOUNT", "COGNITO_DEFAULT")
email_from = os.environ.get("EMAIL_FROM", "")
email_reply = os.environ.get("EMAIL_REPLY", "")
verify_subject = os.environ["VERIFY_SUBJECT"]
verify_message = os.environ["VERIFY_MESSAGE"]

session = botocore.session.get_session()
credentials = session.get_credentials()
if credentials is None:
    print("❌ AWS credentials not found.", file=sys.stderr)
    sys.exit(1)

http = urllib3.PoolManager()


def cognito_api(operation: str, payload: dict) -> dict:
    url = f"https://cognito-idp.{region}.amazonaws.com/"
    body = json.dumps(payload)
    request = AWSRequest(
        method="POST",
        url=url,
        data=body,
        headers={
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": f"AWSCognitoIdentityProviderService.{operation}",
        },
    )
    SigV4Auth(credentials, "cognito-idp", region).add_auth(request)
    prepared = request.prepare()
    response = http.request(
        prepared.method,
        prepared.url,
        body=prepared.body,
        headers=dict(prepared.headers),
    )
    text = response.data.decode("utf-8", errors="replace")
    if response.status >= 400:
        try:
            err = json.loads(text)
        except json.JSONDecodeError:
            err = {"message": text}
        err_type = err.get("__type", "").split(".")[-1] or "ClientError"
        raise RuntimeError(f"{err_type}: {err.get('message', text)}")
    return json.loads(text) if text.strip() else {}


payload = {
    "UserPoolId": pool_id,
    "AutoVerifiedAttributes": ["email"],
    "VerificationMessageTemplate": {
        "DefaultEmailOption": "CONFIRM_WITH_CODE",
        "EmailSubject": verify_subject,
        "EmailMessage": verify_message,
    },
}

enable_mrr = os.environ.get("ENABLE_MRR", "false").lower() == "true"
if enable_mrr:
    payload["KeyConfiguration"] = {
        "KeyType": "CUSTOMER_MANAGED_KEY",
        "KmsKeyArn": kms_arn,
    }
    payload["IssuerConfiguration"] = {"Type": "UPDATED"}

if email_account == "DEVELOPER" and email_from:
    domain = email_from.split("@", 1)[1]
    sts = session.create_client("sts")
    account = sts.get_caller_identity()["Account"]
    email_cfg = {
        "EmailSendingAccount": "DEVELOPER",
        "From": email_from,
        "SourceArn": f"arn:aws:ses:{region}:{account}:identity/{domain}",
    }
    if email_reply:
        email_cfg["ReplyToEmailAddress"] = email_reply
    payload["EmailConfiguration"] = email_cfg
else:
    payload["EmailConfiguration"] = {"EmailSendingAccount": "COGNITO_DEFAULT"}

cognito_api("UpdateUserPool", payload)
pool = cognito_api("DescribeUserPool", {"UserPoolId": pool_id})["UserPool"]
key_cfg = pool.get("KeyConfiguration", {})
email_cfg = pool.get("EmailConfiguration", {})
print(f"   ✅ AutoVerified={pool.get('AutoVerifiedAttributes')}")
print(f"   ✅ KeyType={key_cfg.get('KeyType')}")
print(f"   ✅ Issuer={pool.get('IssuerConfiguration', {}).get('Type')}")
print(f"   ✅ Email={email_cfg.get('EmailSendingAccount')}", end="")
if email_cfg.get("From"):
    print(f" from {email_cfg['From']}")
else:
    print()
PY
