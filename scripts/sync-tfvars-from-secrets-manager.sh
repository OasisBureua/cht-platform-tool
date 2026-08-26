#!/usr/bin/env bash
# Rebuild dev.tfvars / platform.tfvars from *.github.tfvars + AWS Secrets Manager + GitHub env secrets.
# Files are gitignored, never commit the output.
#
# Usage:
#   ./scripts/sync-tfvars-from-secrets-manager.sh [dev|platform|both]
# Requires: aws CLI, jq, python3
# Note: GitHub Environment secret *values* cannot be read back via API/gh CLI, only
#       AWS Secrets Manager fields are populated automatically. Fill any commented
#       keys in *.tfvars manually (or re-copy from your password manager).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VAR_DIR="$REPO_ROOT/infrastructure/terraform/environments/variables"
AWS_REGION="${AWS_REGION:-us-east-1}"
TARGET="${1:-both}"

write_tfvars() {
  local env="$1"
  local gh_env="$2"
  local sm_secret_id="$3"
  python3 - "$env" "$gh_env" "$sm_secret_id" "$VAR_DIR" "$AWS_REGION" <<'PY'
import json, subprocess, sys, datetime, re
from pathlib import Path

env, gh_env, sm_id, var_dir, region = sys.argv[1:6]
var_dir = Path(var_dir)
github_file = var_dir / f"{env}.github.tfvars"
out_file = var_dir / f"{env}.tfvars"

SECRET_KEYS = [
    "supabase_url", "supabase_anon_key", "gotrue_jwt_secret", "mediahub_base_url", "mediahub_api_key",
    "contenthub_base_url", "contenthub_api_key", "youtube_api_key", "youtube_playlist_ids",
    "zoom_account_id", "zoom_client_id", "zoom_client_secret", "zoom_webhook_secret", "zoom_sdk_key", "zoom_sdk_secret",
    "jotform_api_key", "jotform_webinar_default_intake_url", "jotform_webinar_post_event_shared_form_id",
    "bill_dev_key", "bill_username", "bill_password", "bill_org_id", "bill_funding_account_id",
    "bill_webhook_secret", "bill_mfa_remember_me_id", "bill_mfa_device_name",
    "admin_bootstrap_secret", "hubspot_access_token", "recaptcha_secret_key", "internal_cache_secret",
    "cognito_google_client_id", "cognito_google_client_secret", "recaptcha_site_key",
]

GH_FALLBACK = {}  # GitHub does not expose secret values for read-back

def sm_json():
    out = subprocess.check_output([
        "aws", "secretsmanager", "get-secret-value",
        "--secret-id", sm_id, "--region", region,
        "--query", "SecretString", "--output", "text",
    ], text=True)
    return json.loads(out)

def hcl_string(value):
    return json.dumps(value)

sm = sm_json()
vals = {k: (sm.get(k) or "") for k in SECRET_KEYS}

lines = []
lines.append(f"# AUTO-GENERATED: {datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%MZ')}")
lines.append(f"# Source: {env}.github.tfvars + {sm_id}")
lines.append(f"# Regenerate: ./scripts/sync-tfvars-from-secrets-manager.sh {env}")
lines.append("# DO NOT COMMIT")
lines.append("")

for raw in github_file.read_text().splitlines():
    if raw.strip().startswith("#") or not raw.strip():
        continue
    m = re.match(r"\s*([A-Za-z0-9_]+)\s*=", raw)
    if m and m.group(1) in SECRET_KEYS:
        continue
    lines.append(raw)

lines.append("")
lines.append("# ── Secrets ─────────────────────────────────────────────────")
missing = 0
for k in SECRET_KEYS:
    v = vals.get(k, "")
    if v:
        lines.append(f"{k} = {hcl_string(v)}")
    else:
        lines.append(f"# {k} = \"\"  # missing: set manually")
        missing += 1

out_file.write_text("\n".join(lines) + "\n")
print(f"✅ Wrote {out_file} ({missing} keys still empty)")
PY
}

case "$TARGET" in
  dev)
    echo "📥 dev ..."
    write_tfvars dev development cht-dev-app-secrets
    ;;
  platform)
    echo "📥 platform ..."
    write_tfvars platform platform cht-platform-app-secrets
    ;;
  both)
    echo "📥 dev ..."
    write_tfvars dev development cht-dev-app-secrets
    echo "📥 platform ..."
    write_tfvars platform platform cht-platform-app-secrets
    ;;
  *)
    echo "Usage: $0 [dev|platform|both]"
    exit 1
    ;;
esac
