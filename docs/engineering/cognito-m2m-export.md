# Cognito M2M — Content Hub → platform export

Hand-off for Hub (CPR-13/14). Hub only fetches a token and calls export; no Cognito pool code in Hub.

## Env naming

Production uses **`platform.tfvars`** (`environment = "platform"`). That is our prod stack.
Resource names follow the existing prefix rule (no `-prod-` suffix):

| Env (tfvars) | Secrets Manager name |
|--------------|----------------------|
| **platform** (prod) | `cht-platform-cognito-m2m-export` |
| test / other | `cht-platform-{env}-cognito-m2m-export` |

Do not invent a separate `prod` secret name — it would diverge from every other `cht-platform-*` resource.

Secret JSON keys: `client_id`, `client_secret`, `token_url`, `scope` (`platform/export.read`).

Terraform outputs (us-east-1): `cognito_m2m_export_secret_name`, `cognito_m2m_export_token_url`, `cognito_m2m_export_client_id`, `cognito_m2m_export_scope`.

## Token

```bash
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id cht-platform-cognito-m2m-export \
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

```bash
curl -i \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Request-Id: $(uuidgen)" \
  "https://app.communityhealthtoolkit.org/api/export/reports/campaigns/{campaignId}/input-packet"
```

- Missing/invalid token → **401**
- Valid token, wrong/missing scope → **403**
- Missing `X-Request-Id` → **400**
- Auth OK, packet not built yet → **501** (stub)

## Logs (backend)

Search CloudWatch / pino for `[M2M]` or `[export]`:

| Log | Meaning |
|-----|---------|
| `[M2M] ok clientId=… requestId=…` | Token accepted |
| `[M2M] reject reason=missing_bearer\|invalid_token\|missing_scope\|not_configured` | Auth failure (no token body logged) |
| `[Cognito] M2M reject reason=client_id_mismatch\|missing_scope` | JWKS verify detail |
| `[export] input-packet stub=501 … requestId=…` | Auth passed; packet TBD |

Do not use this client for companion (`X-BFF-Auth`) or admin `/api/reports*`.
