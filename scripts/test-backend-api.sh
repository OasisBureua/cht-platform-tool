#!/bin/bash
# Test backend API endpoints (run with backend + docker-compose up)
# Usage: ./scripts/test-backend-api.sh [BASE_URL]
# Default: http://localhost:3000
#
# Protected endpoints require X-Dev-User-Id (Auth0 not configured).
# Run: cd backend && npx prisma db seed  (first time to create dev user)
# Or set TEST_USER_ID env var with a valid user ID from the DB.

BASE_URL=${1:-"http://localhost:3000"}
API="$BASE_URL/api"

# Get dev user ID for auth (when Auth0 not configured)
if [ -z "$TEST_USER_ID" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ROOT_DIR="$(dirname "$SCRIPT_DIR")"
  SEED_OUTPUT=$(cd "$ROOT_DIR/backend" && npx prisma db seed 2>/dev/null) || true
  TEST_USER_ID=$(echo "$SEED_OUTPUT" | grep "X-Dev-User-Id:" | sed 's/.*X-Dev-User-Id: *//' | tr -d ' \r')
fi

echo "🧪 Backend API Test"
echo "==================="
echo "Base: $BASE_URL"
[ -n "$TEST_USER_ID" ] && echo "Auth: X-Dev-User-Id: $TEST_USER_ID (dev bypass)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

pass() { echo -e "${GREEN}✅ PASS${NC} $1"; }
fail() { echo -e "${RED}❌ FAIL${NC} $1"; }

# 1. App info (under /api prefix)
echo "1. App info (GET /api)"
resp=$(curl -s -w "\n%{http_code}" "$API/")
code=$(echo "$resp" | tail -1)
body=$(echo "$resp" | sed '$d')
if [ "$code" = "200" ] && echo "$body" | grep -q "CHT Platform"; then
  pass "App info"
else
  fail "App info (code=$code)"
fi

# 2. Health
echo "2. Health (GET /health)"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
if [ "$code" = "200" ]; then
  pass "Health"
else
  fail "Health (code=$code)"
fi

# 3. Health ready (DB + Redis)
echo "3. Readiness (GET /health/ready)"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health/ready")
if [ "$code" = "200" ]; then
  pass "Readiness"
else
  fail "Readiness (code=$code)"
fi

# 4. Programs (public, no auth)
echo "4. Programs list (GET /api/programs)"
code=$(curl -s -o /dev/null -w "%{http_code}" "$API/programs")
if [ "$code" = "200" ]; then
  pass "Programs list"
else
  fail "Programs list (code=$code)"
fi

# 5. Dashboard earnings (auth required - X-Dev-User-Id when Auth0 not configured)
echo "5. Dashboard earnings (GET /api/dashboard/:userId/earnings)"
if [ -z "$TEST_USER_ID" ]; then
  echo "   Skipped (run: cd backend && npx prisma db seed)"
  fail "Dashboard earnings (no TEST_USER_ID)"
else
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Dev-User-Id: $TEST_USER_ID" "$API/dashboard/$TEST_USER_ID/earnings")
  [ "$code" = "200" ] && pass "Dashboard earnings" || fail "Dashboard earnings (code=$code)"
fi

# 6. Dashboard stats
echo "6. Dashboard stats (GET /api/dashboard/:userId/stats)"
if [ -z "$TEST_USER_ID" ]; then
  fail "Dashboard stats (no TEST_USER_ID)"
else
  code=$(curl -s -o /dev/null -w "%{http_code}" -H "X-Dev-User-Id: $TEST_USER_ID" "$API/dashboard/$TEST_USER_ID/stats")
  [ "$code" = "200" ] && pass "Dashboard stats" || fail "Dashboard stats (code=$code)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Done. Run: cd backend && npm run start:dev"
echo "Ensure: docker-compose up -d (postgres + redis)"
echo "First run: cd backend && npx prisma db seed"
