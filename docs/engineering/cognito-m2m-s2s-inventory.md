# Cognito M2M — S2S inventory & migration plan

**Repo:** cht-platform-tool  
**Audience:** Platform + Content Hub (Syed / Sebastien)  
**Status:** Hub→platform export **done**; Platform→Hub M2M **gated** (`enable_cognito_platform_outbound_m2m=false` until Hub creates RS `hub`); cache.clear M2M accepted dual-run with legacy secret.

Related: [cognito-m2m-export.md](./cognito-m2m-export.md), [cache-sync-contract.md](../runbooks/cache-sync-contract.md), [integrations.md](./integrations.md).

---

## 1. Principles

| Keep as vendor auth | Cognito M2M (CHM↔CHM) |
|---------------------|----------------------|
| Zoom / Stripe / Bill **webhooks** (HMAC / Stripe-Signature) | Hub → platform **export** (`platform/export.read`) — **done** |
| Zoom S2S OAuth, HubSpot private app, Jotform API key, Stripe/Bill/YouTube API keys | Hub → platform **cache clear** (`platform/cache.clear`) — **accepted** (legacy `INTERNAL_CACHE_SECRET` dual-run) |
| Browser session / Cognito user JWT (members + admin UI) | Platform → Hub **Bearer** (client `cht-platform-m2m-{env}`) — **ready in code; enable after Hub RS** |
| reCAPTCHA, admin bootstrap, DB creds | Platform → companion **X-BFF-Auth** — *optional later* |

**Companion note:** Do not reuse `platform/export.read` for chat.

**One pool, one resource server per service.** Platform terraform owns the `platform` RS only. Hub owns the `hub` RS (Hub terraform). Platform does **not** create the hub resource server.

---

## 2. Who calls us (inbound)

| Caller | Method + path | Auth | Secret / store |
|--------|---------------|------|----------------|
| **Content Hub** (ingest) | `GET /api/export/reports/campaigns/:campaignId/input-packet` | Bearer + `platform/export.read` + `X-Request-Id` | SM `cht-{env}-cognito-m2m-export` |
| **Content Hub / ops** | `POST /api/internal/cache/clear*` | Bearer + `platform/cache.clear` **or** legacy `INTERNAL_CACHE_SECRET` | Same Hub M2M client (both scopes) / `internal_cache_secret` |
| **Zoom / Stripe / Bill** | webhooks | Vendor HMAC | vendor secrets |
| **Browser / admin** | `/api/*` | Session / user JWT | `cht-web` PKCE |

---

## 3. APIs we call (outbound)

| We call | Paths | Auth | Secret |
|---------|-------|------|--------|
| **Content Hub public + admin** | `{CONTENTHUB_BASE_URL}/*`, `{CONTENTHUB_ADMIN_BASE_URL}/*` | Cognito M2M Bearer (warm in-memory cache on Nest boot) | SM `cht-{env}-cognito-m2m-platform` → ECS `COGNITO_M2M_PLATFORM_*` |
| **cht-companion** | `/chat` | `X-BFF-Auth` | `COMPANION_INTERNAL_SECRET` |
| Vendors | HubSpot / Zoom / … | vendor | vendor |

Platform outbound Hub scopes (default):  
`hub/catalog.read hub/admin.read hub/admin.create hub/admin.update hub/admin.delete`

Client: `cht-platform-m2m-{env}` on pool `cht-{env}-users`, `client_credentials`.  
Token URL (dev): `https://chm-dev.auth.us-east-1.amazoncognito.com/oauth2/token`.

---

## 4. Clients & Secrets Manager

| Direction | Client | SM name | Scopes |
|-----------|--------|---------|--------|
| Hub → platform | `cht-hub-m2m-{env}` | `cht-{env}-cognito-m2m-export` | `platform/export.read platform/cache.clear` |
| Platform → Hub | `cht-platform-m2m-{env}` | `cht-{env}-cognito-m2m-platform` | hub/… (above) |

Secret JSON: `{ client_id, client_secret, token_url, scope }`.

Enable platform outbound client only after Hub has created RS `hub` on this pool:  
`enable_cognito_platform_outbound_m2m = true` (dev.github.tfvars). Until then leave **false** — Cognito rejects unknown `hub/*` scopes.

---

## 5. Nest behavior

**Inbound (Hub → us):** `CognitoM2mAuthGuard` on `/api/export/*` (`platform/export.read`). Cache clear accepts the same Hub client with `platform/cache.clear`.

**Outbound (us → Hub):** `CognitoM2mTokenService` warms on `OnModuleInit`, caches until ~expiry − 60s, every `ContentHubClientService` / `ContentHubCatalogService` call sends `Authorization: Bearer …`. Missing/failed mint → **401** (no `X-API-Key` fallback).

---

## 6. Mint a token

```bash
SECRET_JSON=$(aws secretsmanager get-secret-value \
  --secret-id cht-dev-cognito-m2m-platform \
  --region us-east-1 \
  --query SecretString --output text)

CLIENT_ID=$(echo "$SECRET_JSON" | jq -r .client_id)
CLIENT_SECRET=$(echo "$SECRET_JSON" | jq -r .client_secret)
TOKEN_URL=$(echo "$SECRET_JSON" | jq -r .token_url)
SCOPE=$(echo "$SECRET_JSON" | jq -r .scope)

curl -s -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d "grant_type=client_credentials&scope=$SCOPE" \
  "$TOKEN_URL" | jq .
```

---

## 7. Remaining cleanup

1. Hub Lambda switches cache clear to M2M Bearer; then drop `INTERNAL_CACHE_SECRET` dual-run.  
2. Remove `contenthub_api_key` from Secrets Manager / TF vars once all envs are on M2M.  
3. Companion M2M (optional, separate ticket).
