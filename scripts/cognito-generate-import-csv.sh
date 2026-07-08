#!/usr/bin/env bash
# Generate Cognito bulk-import CSV for platform users (from data/cognito/platform-users-roles.json).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ROLES_JSON="${REPO_ROOT}/data/cognito/platform-users-roles.json"
OUT_CSV="${REPO_ROOT}/data/cognito/platform-users-import.csv"
POOL_ID="${COGNITO_USER_POOL_ID:-us-east-1_whXKKxAdX}"
AWS_REGION="${AWS_REGION:-us-east-1}"

if [ ! -f "$ROLES_JSON" ]; then
  echo "Missing $ROLES_JSON" >&2
  exit 1
fi

HEADER=$(aws cognito-idp get-csv-header \
  --region "$AWS_REGION" \
  --user-pool-id "$POOL_ID" \
  --query 'CSVHeader' \
  --output json)

python3 <<PY
import csv
import json
import subprocess
from pathlib import Path

roles_path = Path("${ROLES_JSON}")
out_path = Path("${OUT_CSV}")
header = json.loads('''${HEADER}''')

users = json.loads(roles_path.read_text())

def split_name(full: str):
    parts = full.strip().split()
    if not parts:
        return "", "", ""
    if len(parts) == 1:
        return parts[0], "", parts[0]
    return " ".join(parts[:-1]), parts[-1], full.strip()

rows = []
for user in users:
    email = user["email"].strip().lower()
    given, family, display = split_name(user.get("name", email))
    row = {col: "" for col in header}
    row["cognito:username"] = email
    row["email"] = email
    row["email_verified"] = "TRUE"
    row["name"] = display or email
    row["given_name"] = given
    row["family_name"] = family
    row["cognito:mfa_enabled"] = "FALSE"
    rows.append(row)

out_path.parent.mkdir(parents=True, exist_ok=True)
with out_path.open("w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=header, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

print(f"Wrote {len(rows)} users to {out_path}")
PY

echo ""
echo "Upload this file in Cognito → Users → Create import job, or run:"
echo "  ./scripts/cognito-import-platform-users.sh"
