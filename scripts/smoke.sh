#!/usr/bin/env bash
# smoke.sh — post-deploy smoke tests
#
# Verifies a deploy didn't break anything user-visible. Runs immediately
# after a deploy completes (dev or prod). Exits non-zero if anything fails
# so CI / rollback scripts can react.
#
# Usage:
#   ./smoke.sh                                        # defaults to testapp
#   ./smoke.sh testapp.communityhealth.media          # https:// added automatically
#   ./smoke.sh https://testapp.communityhealth.media
#   ./smoke.sh https://staging.testapp.communityhealth.media
#
# Exit codes:
#   0 = all checks passed
#   1 = at least one check failed
#   2 = base URL unreachable (deploy broken at network layer)

set -u

BASE="${1:-https://testapp.communityhealth.media}"
# Allow `./smoke.sh testapp.communityhealth.media` — curl treats bare hosts as http:// → 301.
BASE="${BASE%/}"
if [[ "$BASE" != http://* && "$BASE" != https://* ]]; then
  BASE="https://${BASE}"
fi
fail=0

# ── 0. Base URL reachable? ──────────────────────────────────────
if ! curl -s -o /dev/null --max-time 10 "$BASE"; then
  echo "✗ Base URL not reachable: $BASE"
  exit 2
fi

# ── 1. Health endpoints respond 200 ─────────────────────────────
HEALTH_ENDPOINTS=(
  "/health"
  "/health/ready"
  "/health/live"
)
for ep in "${HEALTH_ENDPOINTS[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE$ep")
  if [ "$code" != "200" ]; then
    echo "✗ $ep returned $code (expected 200)"
    fail=1
  else
    echo "✓ $ep 200"
  fi
done

# ── 2. Critical public pages return 200 + non-empty body ────────
PAGES=(
  "/"
  "/home"
  "/catalog"
  "/kol-network"
  "/login"
  "/join"
  "/contact"
)
for page in "${PAGES[@]}"; do
  out=$(curl -s -w "__STATUS__%{http_code}__SIZE__%{size_download}" --max-time 15 "$BASE$page")
  code="${out##*__STATUS__}"; code="${code%%__SIZE__*}"
  size="${out##*__SIZE__}"
  if [ "$code" != "200" ]; then
    echo "✗ $page returned $code"
    fail=1
  elif [ "${size:-0}" -lt 1000 ]; then
    echo "✗ $page responded $code but body is only ${size}B (likely empty shell)"
    fail=1
  else
    echo "✓ $page 200 (${size}B)"
  fi
done

# ── 3. Auth endpoint behaves (401 is fine — confirms server up) ─
auth_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE/api/auth/me")
if [ "$auth_code" = "200" ] || [ "$auth_code" = "401" ]; then
  echo "✓ /api/auth/me $auth_code (server up)"
else
  echo "✗ /api/auth/me $auth_code (expected 200 or 401)"
  fail=1
fi

echo ""
if [ "$fail" -ne 0 ]; then
  echo "✗ smoke FAILED — investigate before leaving deploy unattended."
  exit 1
fi
echo "✓ smoke passed."
