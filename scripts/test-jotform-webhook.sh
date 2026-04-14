#!/usr/bin/env bash
# Test Jotform webhook locally.
# Prerequisites: backend running (npm run start:dev), postgres + redis up, db seeded.
#
# Usage:
#   ./scripts/test-jotform-webhook.sh [USER_ID] [FORM_ID]
#
# USER_ID: dev user ID from seed (required for SurveyResponse)
# FORM_ID: Jotform form ID - must match a Survey's jotformFormId (default: 260624911991966)
#
# Ensure a Survey has jotformFormId set, e.g.:
#   UPDATE "Survey" SET "jotformFormId" = '260624911991966' WHERE id = 'seed-survey-1';

set -e
API="${API_BASE_URL:-http://localhost:3000}"
USER_ID="${1:-REPLACE_WITH_DEV_USER_ID}"
FORM_ID="${2:-260624911991966}"

# Jotform sends multipart/form-data with rawRequest (JSON string)
RAW_REQUEST=$(cat <<JSON
{
  "submissionID": "test-submission-$(date +%s)",
  "formID": "$FORM_ID",
  "user_id": "$USER_ID",
  "question_1": "High",
  "question_2": "Great activity!"
}
JSON
)

echo "Testing Jotform webhook at $API/api/webhooks/jotform"
echo "User ID: $USER_ID"
echo "Payload: $RAW_REQUEST"
echo ""

curl -s -X POST "$API/api/webhooks/jotform" \
  -F "rawRequest=$RAW_REQUEST" \
  -w "\nHTTP Status: %{http_code}\n"
