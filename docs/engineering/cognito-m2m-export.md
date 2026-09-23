# Cognito M2M — Content Hub → platform export

Hand-off for Hub (CPR-13/14). Hub only fetches a token and calls export; no Cognito pool code in Hub.

## Env naming

Production uses **`platform.tfvars`** (`environment = "platform"`). That is our prod stack.
Resource names follow the existing prefix rule (no `-prod-` suffix):

| Env (tfvars) | Secrets Manager name |
|--------------|----------------------|
| **platform** (prod) | `cht-platform-cognito-m2m-export` |
| test / other | `cht-platform-{env}-cognito-m2m-export` |
| **dev** | `cht-dev-cognito-m2m-export` |

Do not invent a separate `prod` secret name — it would diverge from every other `cht-platform-*` resource.

Secret JSON keys: `client_id`, `client_secret`, `token_url`, `scope` (`platform/export.read`).

Terraform outputs (us-east-1): `cognito_m2m_export_secret_name`, `cognito_m2m_export_token_url`, `cognito_m2m_export_client_id`, `cognito_m2m_export_scope`.

## Token

```bash
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id cht-dev-cognito-m2m-export \
  --region us-east-1 \
  --query SecretString --output text)
CLIENT_ID=$(echo "$SECRET_JSON" | jq -r .client_id)
CLIENT_SECRET=$(echo "$SECRET_JSON" | jq -r .client_secret)
TOKEN_URL=$(echo "$SECRET_JSON" | jq -r .token_url)
SCOPE=$(echo "$SECRET_JSON" | jq -r .scope)

curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=$SCOPE" \
  "$TOKEN_URL"
```

## Export call

`campaignId` is Hub’s `campaigns.id` (free-form string, e.g. `AZ-25-01_LIV001`). URL-encode it.

```bash
CAMPAIGN_ID='AZ-25-01_LIV001'

curl -i \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Request-Id: $(uuidgen)" \
  "https://devapp.communityhealth.media/api/export/reports/campaigns/$(python3 -c "import urllib.parse,os; print(urllib.parse.quote(os.environ['CAMPAIGN_ID'], safe=''))" )/input-packet"
```

Or with a simple id (no special chars beyond `-` / `_`):

```bash
curl -i \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Request-Id: $(uuidgen)" \
  "https://devapp.communityhealth.media/api/export/reports/campaigns/AZ-25-01_LIV001/input-packet"
```

### Status codes

- Missing/invalid token → **401**
- Valid token, wrong/missing scope → **403**
- Missing `X-Request-Id` → **400**
- Auth OK → **200** + JSON packet (empty `sessions` if no Programs linked)

### Packet shape (CPR-28)

```json
{
  "campaignId": "AZ-25-01_LIV001",
  "generatedAt": "2026-09-23T20:00:00.000Z",
  "requestId": "…",
  "sessions": [
    {
      "platformToolProgramId": "cuid…",
      "campaignId": "AZ-25-01_LIV001",
      "kind": "WEBINAR",
      "title": "…",
      "sessionDate": "…",
      "zoomMeetingId": "…",
      "zoomMeetingUuid": "…",
      "transcriptS3Key": "zoom-recordings/{programId}/{meetingId}/{fileId}.vtt",
      "transcriptStatus": "ok",
      "chmProgramId": null
    }
  ],
  "attendance": [],
  "surveys": []
}
```

- Only Programs with `Program.campaignId` matching are included (null/unlinked omitted).
- `transcriptStatus` is `ok` only when Zoom Pull has stored a COMPLETED TRANSCRIPT/CC `s3Key`; otherwise `missing` (no VTT inline; no pull-on-read).
- Export does **not** call Zoom or S3. Hub S3 Lambda / GetObject owns transcript bytes in Hub DB.

Link a Program (admin webinar update): `PATCH /api/admin/programs/:id` body `{ "campaignId": "AZ-25-01_LIV001" }` (null/empty clears).

## Logs (backend)

Search CloudWatch / pino for `[M2M]` or `[export]`:

| Log | Meaning |
|-----|---------|
| `[M2M] ok clientId=… requestId=…` | Token accepted |
| `[M2M] reject reason=missing_bearer\|invalid_token\|missing_scope\|not_configured` | Auth failure (no token body logged) |
| `[Cognito] M2M reject reason=client_id_mismatch\|missing_scope` | JWKS verify detail |
| `[export] input-packet ok … sessions=N requestId=…` | Packet returned |

Do not use this client for companion (`X-BFF-Auth`) or admin `/api/reports*`.
