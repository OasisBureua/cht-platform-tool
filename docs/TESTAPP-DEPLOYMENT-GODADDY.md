# Deploy testapp.communityhealth.media (DNS on GoDaddy)

Domain `communityhealth.media` is on GoDaddy. This guide gets the app running at `testapp.communityhealth.media` with HTTPS.

**End result:**
- `https://app.testapp.communityhealth.media` → frontend
- `https://api.testapp.communityhealth.media` → backend API

---

## Phase 1: ACM Certificate (Do This First)

ACM certificates must be validated before you can use them. Do this before deploying Terraform.

### Step 1: Request the certificate

```bash
./scripts/request-certificate-testapp.sh
```

This creates a certificate for `*.testapp.communityhealth.media` and `testapp.communityhealth.media`, and prints the DNS records you need.

### Step 2: Add CNAME in GoDaddy

1. Go to [dns.godaddy.com](https://dns.godaddy.com) → select `communityhealth.media`
2. Click **Add** → **CNAME**
3. Use the values from the script output, for example:
   - **Name:** `_acme-challenge.testapp` (or the full name minus `.communityhealth.media`)
   - **Value:** (the long value ACM gives you, e.g. `_xxxxx.acm-validations.aws.`)
   - **TTL:** 600 (or 10 minutes)

> If GoDaddy only wants the host part, use `_acme-challenge.testapp`. If it wants the full record name, use `_acme-challenge.testapp.communityhealth.media`.

### Step 3: Wait for validation

```bash
./scripts/check-certificates-status.sh testapp
```

Wait until status is **ISSUED** (often 5–30 minutes).

### Step 4: Get the certificate ARN

```bash
cat infrastructure/terraform/environments/variables/.cert-arns-testapp
```

Copy the `certificate_arn` value.

---

## Phase 2: Update Terraform Variables

Edit `infrastructure/terraform/environments/variables/dev.tfvars`:

```hcl
# Use testapp subdomain
domain_name = "testapp.communityhealth.media"

# ACM certificate ARN from Phase 1 (same cert for ALB and CloudFront, both in us-east-1)
acm_certificate_arn        = "arn:aws:acm:us-east-1:YOUR_ACCOUNT:certificate/YOUR_CERT_ID"
cloudfront_certificate_arn = "arn:aws:acm:us-east-1:YOUR_ACCOUNT:certificate/YOUR_CERT_ID"
```

---

## Phase 3: Deploy Infrastructure

1. **Terraform state backend** (if not already done):

   ```bash
   aws s3 mb s3://cht-platform-terraform-state-dev --region us-east-1
   # ... enable versioning, encryption, DynamoDB lock (see DEPLOYMENT.md)
   ```

2. **Deploy:**

   ```bash
   cd infrastructure/terraform/environments/us-east-1
   terraform init
   terraform plan -var-file="../variables/dev.tfvars"
   terraform apply -var-file="../variables/dev.tfvars"
   ```

   Or use the deploy script:

   ```bash
   ./scripts/deploy-primary.sh dev
   ```

3. **Note Route53 nameservers:**

   ```bash
   cd infrastructure/terraform/environments/us-east-1
   terraform output route53_nameservers
   ```

   Terraform will create a hosted zone for `testapp.communityhealth.media` and records for `api` and `app`.

---

## Phase 4: Point GoDaddy to Route53

Add the delegation in GoDaddy.

1. Go to [dns.godaddy.com](https://dns.godaddy.com) → `communityhealth.media`
2. Add **NS** records for the `testapp` subdomain:

   - **Type:** NS  
   - **Name:** `testapp` (or `testapp.communityhealth.media` depending on GoDaddy’s UI)  
   - **Value:** (each of the 4 Route53 nameservers, e.g. `ns-123.awsdns-45.com`)

   Add one NS record per nameserver (4 total).

> Some GoDaddy setups use subdomain delegation. If you see “Subdomain” or “Manage subdomains”, add `testapp` and set its nameservers to the Route53 values.

### Alternative: CNAME only (no Route53 zone)

If you prefer not to use Route53 for `testapp.communityhealth.media`:

1. Get ALB and CloudFront hostnames from Terraform outputs.
2. In GoDaddy add:
   - `api.testapp` → CNAME → ALB DNS name
   - `app.testapp` → CNAME → CloudFront domain

Then you can skip creating the Route53 zone and use GoDaddy for all DNS. The route53 module currently creates a zone; you’d need to make it optional or remove it and rely on manual GoDaddy records.

---

## Phase 5: Run Migrations & Deploy Frontend

```bash
# Migrations (see DEPLOYMENT.md for ECS exec)
# ...

# Frontend
cd frontend
npm run build
# Sync to S3, invalidate CloudFront (see deploy-frontend.sh)
```

---

## Quick Reference

| Step | Action |
|------|--------|
| 1 | `./scripts/request-certificate-testapp.sh` |
| 2 | Add CNAME in GoDaddy for ACM validation |
| 3 | `./scripts/check-certificates-status.sh testapp` until ISSUED |
| 4 | Update dev.tfvars with `domain_name` and cert ARNs |
| 5 | `./scripts/deploy.sh dev apply` |
| 6 | Add NS records in GoDaddy for `testapp` → Route53 nameservers |
| 7 | Run migrations, deploy frontend |

---

## Troubleshooting

### Certificate stays PENDING_VALIDATION

- Confirm the CNAME is correct in GoDaddy.
- DNS propagation can take up to 48 hours (often 5–30 minutes).
- `dig _acme-challenge.testapp.communityhealth.media CNAME` should return the validation value.

### App not reachable after deploy

- Verify NS records for `testapp` in GoDaddy.
- Test ALB directly: `curl https://api.testapp.communityhealth.media/health/ready`.
- Test CloudFront: `curl -I https://app.testapp.communityhealth.media`.
