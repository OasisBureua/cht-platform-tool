#!/bin/bash

BACKEND_URL=${1:-"http://localhost:3000"}

echo "🏥 Testing Health Endpoints"
echo "Backend: $BACKEND_URL"
echo ""

echo "1️⃣  Basic Health (ALB uses this)"
echo "GET $BACKEND_URL/health"
HEALTH=$(curl -s "$BACKEND_URL/health")
echo "$HEALTH" | jq '.'
STATUS=$(echo "$HEALTH" | jq -r '.status')
if [ "$STATUS" == "ok" ]; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi
echo ""

echo "2️⃣  Readiness Check (DB + Redis)"
echo "GET $BACKEND_URL/health/ready"
READY=$(curl -s "$BACKEND_URL/health/ready")
echo "$READY" | jq '.'
STATUS=$(echo "$READY" | jq -r '.status')
if [ "$STATUS" == "ok" ]; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi
echo ""

echo "3️⃣  Liveness Check"
echo "GET $BACKEND_URL/health/live"
LIVE=$(curl -s "$BACKEND_URL/health/live")
echo "$LIVE" | jq '.'
STATUS=$(echo "$LIVE" | jq -r '.status')
if [ "$STATUS" == "ok" ]; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi
echo ""

echo "4️⃣  Detailed Health"
echo "GET $BACKEND_URL/health/detail"
DETAIL=$(curl -s "$BACKEND_URL/health/detail")
echo "$DETAIL" | jq '.'
STATUS=$(echo "$DETAIL" | jq -r '.status')
if [ "$STATUS" == "ok" ]; then
    echo "✅ PASS"
else
    echo "❌ FAIL"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if curl -sf "$BACKEND_URL/health" > /dev/null && \
   curl -sf "$BACKEND_URL/health/ready" > /dev/null && \
   curl -sf "$BACKEND_URL/health/live" > /dev/null && \
   curl -sf "$BACKEND_URL/health/detail" > /dev/null; then
    echo "✅ All health checks passed!"
    exit 0
else
    echo "❌ Some health checks failed"
    exit 1
fi