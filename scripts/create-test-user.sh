#!/bin/bash
# Create a test user in GoTrue (shared CHT auth)
# Usage: ./scripts/create-test-user.sh [email] [password]

AUTH_URL="https://mediahub.communityhealth.media/auth/v1"
API_KEY="${GOTRUE_ANON_KEY:-public}"
EMAIL="${1:-test@cht-platform.local}"
PASSWORD="${2:-TestPassword123!}"

echo "Creating test user: $EMAIL"
echo ""

curl -s -X POST "${AUTH_URL}/signup" \
  -H "Content-Type: application/json" \
  -H "apikey: $API_KEY" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"

echo ""
echo "If successful, you can log in at /login with:"
echo "  Email: $EMAIL"
echo "  Password: $PASSWORD"
