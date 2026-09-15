#!/bin/bash
# Apply Cognito user pool settings that Terraform cannot manage on MRR-enabled pools.
#
# When multi-Region replication is enabled, UpdateUserPool must include KeyConfiguration
# (customer-managed KMS). AWS provider 5.x omits that field, so deploy-primary.sh calls
# this script after terraform apply instead of updating the pool in Terraform.
#
# Also applies SMS MFA configuration via SetUserPoolMfaConfig when the Cognito→SNS
# IAM role outputs are present (enable_cognito_sms_mfa = true).
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
  # CI often uses *.github.tfvars
  if [ -f "$REPO_ROOT/infrastructure/terraform/environments/variables/${ENV}.github.tfvars" ]; then
    VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/${ENV}.github.tfvars"
  else
    echo "❌ Variable file not found: $VAR_FILE"
    exit 1
  fi
fi

read_tfvar() {
  grep -E "^${1}[[:space:]]*=" "$VAR_FILE" | head -1 | sed -E 's/^[^"]*"([^"]+)".*/\1/'
}

read_tfvar_bool() {
  grep -E "^${1}[[:space:]]*=" "$VAR_FILE" | head -1 | sed -E 's/^[^=]*=[[:space:]]*//' | tr '[:upper:]' '[:lower:]' | tr -d ' '
}

ENABLE_MRR=$(read_tfvar_bool enable_cognito_mrr)
EMAIL_ACCOUNT=$(read_tfvar cognito_email_sending_account)
ENABLE_SMS=$(read_tfvar_bool enable_cognito_sms_mfa)
MFA_CONFIG=$(read_tfvar cognito_mfa_configuration)
if [ -z "$MFA_CONFIG" ]; then
  MFA_CONFIG="OPTIONAL"
fi

NEED_EMAIL_SYNC=false
if [ "$ENABLE_MRR" = "true" ] || [ "$EMAIL_ACCOUNT" = "DEVELOPER" ]; then
  NEED_EMAIL_SYNC=true
fi
NEED_SMS_SYNC=false
if [ "$ENABLE_SMS" = "true" ]; then
  NEED_SMS_SYNC=true
fi

if [ "$NEED_EMAIL_SYNC" != "true" ] && [ "$NEED_SMS_SYNC" != "true" ]; then
  echo "ℹ️  No Cognito pool sync needed (MRR/email/SMS sync off)."
  exit 0
fi

cd "$TF_DIR"
terraform init -input=false -reconfigure -backend-config="$BACKEND_CONFIG" >/dev/null
USER_POOL_ID=$(terraform output -raw cognito_user_pool_id 2>/dev/null || true)
KMS_KEY_ARN=$(terraform output -raw cognito_kms_key_arn 2>/dev/null || true)
SMS_CALLER_ARN=$(terraform output -raw cognito_sms_sns_caller_arn 2>/dev/null || true)
SMS_EXTERNAL_ID=$(terraform output -raw cognito_sms_external_id 2>/dev/null || true)
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
if [ "$NEED_SMS_SYNC" = "true" ]; then
  echo "   SMS:  caller=${SMS_CALLER_ARN:-'(missing)'} externalId=${SMS_EXTERNAL_ID:-'(missing)'}"
fi
echo ""

export USER_POOL_ID KMS_KEY_ARN PRIMARY_REGION EMAIL_ACCOUNT EMAIL_FROM EMAIL_REPLY VERIFY_SUBJECT VERIFY_MESSAGE ENABLE_MRR
export NEED_EMAIL_SYNC NEED_SMS_SYNC SMS_CALLER_ARN SMS_EXTERNAL_ID MFA_CONFIG

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
need_email = os.environ.get("NEED_EMAIL_SYNC", "false").lower() == "true"
need_sms = os.environ.get("NEED_SMS_SYNC", "false").lower() == "true"
sms_caller = (os.environ.get("SMS_CALLER_ARN") or "").strip()
sms_external = (os.environ.get("SMS_EXTERNAL_ID") or "").strip()
mfa_config = (os.environ.get("MFA_CONFIG") or "OPTIONAL").strip().upper()
if mfa_config not in ("OFF", "OPTIONAL", "ON"):
    mfa_config = "OPTIONAL"

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


if need_email:
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

    if need_sms and sms_caller and sms_external:
        payload["SmsConfiguration"] = {
            "SnsCallerArn": sms_caller,
            "ExternalId": sms_external,
            "SnsRegion": region,
        }

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
    sms_cfg = pool.get("SmsConfiguration") or {}
    if sms_cfg.get("SnsCallerArn"):
        print(f"   ✅ SmsConfiguration caller={sms_cfg.get('SnsCallerArn')}")

if need_sms:
    if not sms_caller or not sms_external:
        print(
            "❌ enable_cognito_sms_mfa is true but cognito_sms_* Terraform outputs are missing. Apply Cognito module first.",
            file=sys.stderr,
        )
        sys.exit(1)

    mfa_payload = {
        "UserPoolId": pool_id,
        "MfaConfiguration": mfa_config,
        "SoftwareTokenMfaConfiguration": {"Enabled": True},
        "SmsMfaConfiguration": {
            "SmsAuthenticationMessage": "Your Community Health Media sign-in code is {####}",
            "SmsConfiguration": {
                "SnsCallerArn": sms_caller,
                "ExternalId": sms_external,
                "SnsRegion": region,
            },
        },
    }
    cognito_api("SetUserPoolMfaConfig", mfa_payload)
    mfa = cognito_api("GetUserPoolMfaConfig", {"UserPoolId": pool_id})
    print(f"   ✅ MfaConfiguration={mfa.get('MfaConfiguration')}")
    print(
        f"   ✅ SoftwareTokenMfa={mfa.get('SoftwareTokenMfaConfiguration', {}).get('Enabled')}"
    )
    print(
        f"   ✅ SmsMfa configured={bool((mfa.get('SmsMfaConfiguration') or {}).get('SmsConfiguration'))}"
    )
PY
