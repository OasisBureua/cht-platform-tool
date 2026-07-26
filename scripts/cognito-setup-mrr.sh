#!/bin/bash
# Enable Cognito Multi-Region Replication (MRR) on an existing user pool.
#
# Terraform creates the multi-Region KMS keys (with Cognito key policy). This
# script completes steps that require Cognito MRR APIs not yet in AWS CLI/boto3
# service models (June 2026): attach CMK, switch OIDC issuer, create replica.
#
# Prerequisites:
#   - enable_cognito_mrr = true applied (KMS MRK exists with Cognito key policy)
#   - User pool on ESSENTIALS or PLUS tier
#   - Python 3 + boto3/botocore (uses raw SigV4 JSON API calls)
#
# Usage:
#   USER_POOL_ID=us-east-1_XXXX KMS_KEY_ARN=arn:aws:kms:... ./scripts/cognito-setup-mrr.sh
#   ./scripts/cognito-setup-mrr.sh dev
#   ACTIVATE=true ./scripts/cognito-setup-mrr.sh dev
#
set -euo pipefail

ENV="${1:-dev}"
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
REPLICA_REGION="${REPLICA_REGION:-us-east-2}"
ACTIVATE="${ACTIVATE:-false}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TF_DIR="$REPO_ROOT/infrastructure/terraform/environments/us-east-1"
BACKEND_CONFIG="$REPO_ROOT/infrastructure/terraform/environments/backends/us-east-1-${ENV}.hcl"
VAR_FILE="$REPO_ROOT/infrastructure/terraform/environments/variables/${ENV}.tfvars"

if [ -z "${USER_POOL_ID:-}" ] || [ -z "${KMS_KEY_ARN:-}" ]; then
  if [ ! -f "$VAR_FILE" ]; then
    echo "❌ Set USER_POOL_ID and KMS_KEY_ARN, or pass environment with tfvars (e.g. dev)"
    exit 1
  fi
  cd "$TF_DIR"
  terraform init -input=false -reconfigure -backend-config="$BACKEND_CONFIG" >/dev/null
  USER_POOL_ID="${USER_POOL_ID:-$(terraform output -raw cognito_user_pool_id)}"
  KMS_KEY_ARN="${KMS_KEY_ARN:-$(terraform output -raw cognito_kms_key_arn)}"
  cd "$REPO_ROOT"
fi

if [ -z "$USER_POOL_ID" ] || [ "$USER_POOL_ID" = "null" ]; then
  echo "❌ Cognito user pool ID not found. Set enable_cognito_pools = true and apply first."
  exit 1
fi

if [ -z "$KMS_KEY_ARN" ] || [ "$KMS_KEY_ARN" = "null" ]; then
  echo "❌ Cognito KMS key not found. Set enable_cognito_mrr = true and apply first."
  exit 1
fi

echo "🔐 Cognito MRR setup"
echo "   Pool:    $USER_POOL_ID"
echo "   Primary: $PRIMARY_REGION"
echo "   Replica: $REPLICA_REGION"
echo "   KMS:     $KMS_KEY_ARN"
echo ""

run_python() {
  python3 - "$@" <<'PY'
import json
import os
import sys

try:
    import botocore.session
    from botocore.auth import SigV4Auth
    from botocore.awsrequest import AWSRequest
    import urllib3
except ImportError:
    print("❌ boto3/botocore required. Install: pip3 install --user boto3", file=sys.stderr)
    sys.exit(1)

pool_id = os.environ["USER_POOL_ID"]
primary = os.environ["PRIMARY_REGION"]
replica = os.environ["REPLICA_REGION"]
kms_arn = os.environ["KMS_KEY_ARN"]
activate = os.environ.get("ACTIVATE", "false").lower() == "true"
env_name = os.environ.get("ENV_NAME", "dev")

http = urllib3.PoolManager()
session = botocore.session.get_session()
credentials = session.get_credentials()
if credentials is None:
    print("❌ AWS credentials not found. Configure aws configure or env vars.", file=sys.stderr)
    sys.exit(1)


def cognito_json_api(operation: str, payload: dict, region: str) -> dict:
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
    if not text.strip():
        return {}
    return json.loads(text)


def update_pool(**fields):
    payload = {"UserPoolId": pool_id, **fields}
    cognito_json_api("UpdateUserPool", payload, primary)


def cmk_configuration():
    return {
        "KeyType": "CUSTOMER_MANAGED_KEY",
        "KmsKeyArn": kms_arn,
    }


def describe_pool():
    resp = cognito_json_api("DescribeUserPool", {"UserPoolId": pool_id}, primary)
    return resp.get("UserPool", {})


def key_configuration(pool):
    return pool.get("KeyConfiguration") or {}


print("1️⃣  Attaching multi-Region KMS key to user pool...")
pool = describe_pool()
current_key = key_configuration(pool)
if current_key.get("KeyType") == "CUSTOMER_MANAGED_KEY":
    print(f"   ℹ️  CMK already set: {current_key.get('KmsKeyArn', '(unknown)')}")
elif current_key.get("KeyType") == "AWS_OWNED_KEY":
    try:
        update_pool(
            KeyConfiguration=cmk_configuration(),
            AutoVerifiedAttributes=["email"],
        )
    except RuntimeError as e:
        msg = str(e)
        if "InvalidParameterException" in msg and "kms:DescribeKey" in msg:
            print(f"   ❌ KMS key policy missing Cognito access: {msg}")
            print("   → Re-apply primary Terraform (enable_cognito_mrr) to update the MRK policy,")
            print("     or add cognito-idp.amazonaws.com + identitystore.amazonaws.com to the key policy.")
            sys.exit(1)
        raise

    pool = describe_pool()
    updated_key = key_configuration(pool)
    if updated_key.get("KeyType") != "CUSTOMER_MANAGED_KEY":
        print("   ❌ Pool still uses AWS_OWNED_KEY after update.")
        print("   Cognito MRR requires a customer-managed KMS key set at user pool creation time.")
        print("   Existing pools cannot be retrofitted; recreate the pool with KeyConfiguration, then rerun this script.")
        print("   See docs/runbooks/cognito-migration-spec.md §1.6.")
        sys.exit(1)

    print(f"   ✅ KMS attached: {updated_key.get('KmsKeyArn', kms_arn)}")
else:
    print(f"   ❌ Unexpected KeyConfiguration: {current_key}")
    sys.exit(1)

print("2️⃣  Switching to multi-Region OIDC issuer (UPDATED)...")
print("   ⚠️  This changes the iss claim in new tokens. Backend JWKS validation uses pool ID and should continue to work.")
try:
    # Cognito resets omitted fields on UpdateUserPool — always resend CMK with issuer update.
    update_pool(
        KeyConfiguration=cmk_configuration(),
        IssuerConfiguration={"Type": "UPDATED"},
        AutoVerifiedAttributes=["email"],
    )
    pool = describe_pool()
    updated_key = key_configuration(pool)
    if updated_key.get("KeyType") != "CUSTOMER_MANAGED_KEY":
        print(f"   ❌ Issuer update reset encryption key to {updated_key.get('KeyType', 'unknown')}.")
        print("   Retry after confirming the pool supports customer-managed keys at creation.")
        sys.exit(1)
    if pool.get("IssuerConfiguration", {}).get("Type") != "UPDATED":
        print(f"   ⚠️  Issuer not UPDATED yet: {pool.get('IssuerConfiguration')}")
        print("   → Complete in Console: User pool → Domain → Edit → Issuer type = Updated")
    else:
        print("   ✅ Issuer updated")
except RuntimeError as e:
    msg = str(e)
    if "InvalidParameterException" in msg and ("IssuerConfiguration" in msg or "Issuer" in msg):
        print(f"   ⚠️  Issuer update via API not available: {msg}")
        print("   → Complete Step 2 in Console: User pool → Domain → Edit → Issuer type = Updated")
    else:
        raise

print(f"3️⃣  Creating replica user pool in {replica}...")
try:
    resp = cognito_json_api(
        "CreateUserPoolReplica",
        {"UserPoolId": pool_id, "RegionName": replica},
        primary,
    )
    replica_info = resp.get("UserPoolReplica") or resp.get("Replica") or {}
    status = replica_info.get("Status", "UNKNOWN")
    print(f"   ✅ Replica create initiated (status={status})")
except RuntimeError as e:
    msg = str(e)
    if "ResourceConflictException" in msg or "already exists" in msg.lower():
        print("   ℹ️  Replica already exists")
    else:
        raise

if activate:
    print("4️⃣  Activating replica...")
    try:
        resp = cognito_json_api(
            "UpdateUserPoolReplica",
            {"UserPoolId": pool_id, "RegionName": replica, "Status": "ACTIVE"},
            primary,
        )
        replica_info = resp.get("UserPoolReplica") or resp.get("Replica") or {}
        status = replica_info.get("Status", "ACTIVE")
        print(f"   ✅ Replica status={status}")
    except RuntimeError as e:
        print(f"   ❌ Activate failed: {e}")
        print("   → Activate manually: Cognito → User pool → Multi-Region replication → Active")
        sys.exit(1)

print("")
print("✅ MRR setup steps complete.")
print("")
print("Next:")
print(f"  1. In Console, verify replica status and regional email settings in {replica}")
print(f"  2. Set cognito_mrr_associate_waf_replica = true in {env_name}.tfvars (if WAF enabled)")
print(f"  3. Re-apply: ./scripts/deploy-primary.sh {env_name}")
PY
}

export USER_POOL_ID KMS_KEY_ARN PRIMARY_REGION REPLICA_REGION ACTIVATE ENV_NAME="$ENV"
run_python

echo ""
echo "Optional: activate replica for production traffic:"
echo "  ACTIVATE=true ./scripts/cognito-setup-mrr.sh $ENV"
