# HubSpot Removal Checklist

**Note:** There is **no HubSpot in the Prisma schema**. HubSpot is only used for **email delivery** (SMTP) in the worker. Removing it means switching the worker to Amazon SES.

---

## Files to Update (Remove HubSpot References)

### Worker (switch to SES)

| File | Change |
|------|--------|
| `worker/services/email_service.py` | Replace HubSpot SMTP with boto3 SES |
| `worker/.env.example` | Remove HUBSPOT_*, add SES_FROM_EMAIL |

### Infrastructure / Terraform

| File | Change |
|------|--------|
| `infrastructure/terraform/environments/variables/dev.tfvars` | Remove hubspot_smtp_user, hubspot_smtp_password |
| `infrastructure/terraform/environments/variables/prod.tfvars` | Remove hubspot_smtp_user, hubspot_smtp_password |
| `infrastructure/terraform/environments/us-east-2/variables.tf` | Remove hubspot_smtp_user, hubspot_smtp_password variables |

### GitHub Actions

| File | Change |
|------|--------|
| `.github/workflows/deploy-dev.yml` | Remove TF_VAR_hubspot_smtp_user, TF_VAR_hubspot_smtp_password |
| `.github/workflows/deploy-prod.yml` | Remove TF_VAR_hubspot_smtp_user, TF_VAR_hubspot_smtp_password |

### Scripts

| File | Change |
|------|--------|
| `scripts/verify-github-secrets.sh` | Remove HUBSPOT_SMTP_USER, HUBSPOT_SMTP_PASSWORD |

### Documentation

| File | Change |
|------|--------|
| `README.md` | Replace "HubSpot (Email via SMTP)" with "Amazon SES (Email)" |
| `docs/README.md` | Update Email section for SES |
| `docs/DEPLOYMENT.md` | Remove hubspot_smtp references |
| `docs/TEAM-EMAIL-CREDENTIALS-NEEDED.md` | Remove HubSpot section, add SES |
| `docs/TESTING-CHECKLIST.md` | Replace "HubSpot emails" with "SES emails" |
| `infrastructure/README.md` | Remove hubspot TF_VAR exports |
| `worker/requirements.txt` | Update comment (SES uses boto3, already in requirements) |

---

## Prerequisites Before Removal

1. **Amazon SES setup**
   - Verify domain (e.g. communityhealth.media) in SES
   - Request production access if in sandbox
   - Add `ses:SendEmail` to worker IAM role

2. **Update `email_service.py`**
   - Use boto3 `ses.send_email()` instead of smtplib
   - Read `SES_FROM_EMAIL` from env (or use default)

3. **Remove GitHub secrets** (after SES is working)
   - Delete `HUBSPOT_SMTP_USER`
   - Delete `HUBSPOT_SMTP_PASSWORD`

---

## Order of Operations

1. Implement SES in `email_service.py` (keep HubSpot as fallback initially, or replace)
2. Deploy worker with SES env vars
3. Test email sending
4. Remove HubSpot from all config/docs
5. Remove GitHub secrets
