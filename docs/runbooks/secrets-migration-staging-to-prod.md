# Runbook: Secrets migration (staging → production)

Ensure **production** has every secret and configuration value needed **before** destroying the staging AWS stack or GitHub `staging` environment.

**When to run:** Phase 0 — complete **before** [staging-teardown.md](./staging-teardown.md).

**Owner:** Uche Aduakaa  
**Reviewer:** Adaze Oviawe  
**Approved:** June 16, 2026 at 08:28 PM EDT

---

## Goal

Production (`platform` GitHub Environment + `cht-platform-app-secrets` in AWS) must be self-sufficient. Staging secrets must not be the only copy of any value prod still needs.

---

## Pre-flight

- [x] AWS CLI authenticated to account `233636046512`, region `us-east-1`
- [x] GitHub CLI authenticated (`gh auth login`)
- [x] Write access to GitHub **Environments → platform**
- [x] Document completion in a ticket with date and operator name

---

## Step 1 — Verify production GitHub secrets

```bash
./scripts/verify-github-secrets.sh platform
```

All **required** secrets must show ✅. Fix missing values:

```bash
# Optional helper if you maintain platform.tfvars locally (never commit secrets)
./scripts/sync-github-secrets-from-tfvars.sh platform
```

### Required GitHub Environment secrets (`platform`)


| Secret                       | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| `AWS_ROLE_ARN`               | OIDC deploy role                                 |
| `ACM_CERTIFICATE_ARN`        | ALB HTTPS                                        |
| `CLOUDFRONT_CERTIFICATE_ARN` | CloudFront HTTPS                                 |
| `SUPABASE_ANON_KEY`          | GoTrue (remove after Cognito cutover)            |
| `GOTRUE_JWT_SECRET`          | JWT validation (remove after Cognito cutover)    |
| `MEDIAHUB_API_KEY`           | Catalog / HCP sync                               |
| `YOUTUBE_API_KEY`            | Podcasts / catalog                               |
| `YOUTUBE_PLAYLIST_IDS`       | Catalog playlists                                |
| `ZOOM_*`                     | Webinars (account, client, secret, webhook, SDK) |
| `JOTFORM_API_KEY`            | Surveys                                          |
| `BILL_*`                     | Honorarium payouts                               |
| `HUBSPOT_ACCESS_TOKEN`       | Contact sync                                     |


### Optional (verify if used in prod)


| Secret                    | Purpose           |
| ------------------------- | ----------------- |
| `BILL_WEBHOOK_SECRET`     | Bill.com webhooks |
| `BILL_MFA_REMEMBER_ME_ID` | Worker pay login  |
| `BILL_MFA_DEVICE_NAME`    | Worker pay login  |
| `ADMIN_BOOTSTRAP_SECRET`  | Admin bootstrap   |


- [ ] All required prod secrets verified

---

## Step 2 — Compare staging vs platform

If staging environment still exists:

```bash
./scripts/verify-github-secrets.sh staging
./scripts/verify-github-secrets.sh platform
```

For each secret present in **staging** but missing or empty in **platform**:

1. Copy value into `platform` GitHub Environment (Settings → Environments → platform → Environment secrets).
2. Record secret name in migration log (do **not** paste secret values into tickets or docs).

```bash
# Example: set a single secret (run locally, value not echoed)
gh secret set MEDIAHUB_API_KEY --env platform --body "<value-from-staging>"
```

- [ ] Staging-only secrets reconciled into platform (or confirmed intentionally staging-only)

---

## Step 3 — Verify AWS Secrets Manager (runtime)

Production app secrets JSON:

```bash
aws secretsmanager get-secret-value \
  --secret-id cht-platform-app-secrets \
  --region us-east-1 \
  --query SecretString --output text | jq 'keys'
```

Staging (before destroy):

```bash
aws secretsmanager get-secret-value \
  --secret-id cht-platform-staging-app-secrets \
  --region us-east-1 \
  --query SecretString --output text | jq 'keys'
```

Ensure prod JSON contains non-empty values for integrations listed in [integrations.md](../engineering/integrations.md).

If prod is stale and staging is known-good (historical one-time fix):

```bash
# Copies platform → staging normally; reverse manually if ever needed
# Prefer updating prod GitHub secrets + redeploy over copying staging → prod blindly
./scripts/bootstrap-staging-secrets-from-platform.sh  # staging ← platform (reference only)
```

- [x] `cht-platform-app-secrets` validated for prod runtime
- [x] No integration relies on staging Secrets Manager after teardown

---

## Step 4 — Non-secret config in tfvars

Check `infrastructure/terraform/environments/variables/`:


| File                              | Notes                                                    |
| --------------------------------- | -------------------------------------------------------- |
| `platform.tfvars` / `prod.tfvars` | Prod sizing, domain, JotForm form IDs                    |
| `staging.tfvars`                  | Copy any prod-relevant **non-secret** IDs before destroy |


Examples to compare:

- `jotform_webinar_post_event_shared_form_id`
- `jotform_webinar_default_intake_url`
- `domain_name`
- `mediahub_base_url` (until internal Hub cutover)

- [x] Prod tfvars contains all non-secret IDs prod needs

---

## Step 5 — Document staging-only values (safe to lose)

Record anything that **only existed for staging** and is **not** needed in prod:


| Item                                        | Keep for prod? | Notes                                    |
| ------------------------------------------- | -------------- | ---------------------------------------- |
| `staging.testapp.communityhealth.media` DNS | No             | Retired in staging teardown              |
| Staging RDS data                            | Usually no     | Optional snapshot — see staging teardown |
| Staging-specific test users                 | No             |                                          |
| Staging admin bootstrap secret              | No             | Prod has its own                         |


- [x] Team agrees nothing on this list blocks prod

---

## Exit criteria

- [x] `./scripts/verify-github-secrets.sh platform` passes
- [x] Prod Secrets Manager validated
- [x] Migration log completed (secret **names** only)
- [x] Sign-off from engineering lead (Uche Aduakaa, reviewed by Adaze Oviawe — June 16, 2026 at 08:28 PM EDT)

**Then proceed to:** [staging-teardown.md](./staging-teardown.md)

---

## Rollback

Not applicable — this is a verification/migration checklist. If a secret was copied incorrectly, update `platform` GitHub secret and redeploy backend:

```bash
# GitHub Actions → Deploy to Platform → Run workflow
```

