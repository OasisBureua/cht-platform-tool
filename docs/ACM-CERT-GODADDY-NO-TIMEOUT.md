# ACM Certificate for testapp.communityhealth.media – Avoid Timeout

Domain `communityhealth.media` is on GoDaddy. ACM validation **times out after 72 hours** if the DNS record is not added correctly. Follow these steps to avoid that.

---

## Before You Start

1. **Get GoDaddy access** – You need someone with DNS access to add the CNAME record within a few hours of requesting the cert.
2. **Use DNS validation** – The script uses DNS (not email), so no email links to click. The only blocker is the CNAME record in GoDaddy.

---

## Step-by-Step (Do in One Session)

### 1. Request the certificate

```bash
./scripts/request-certificate-testapp.sh
```

This prints:
- Certificate ARN
- **Name** and **Value** for the CNAME record

Copy both. Example output:
```
Primary CNAME (add in GoDaddy):
  Name:  _acme-challenge.testapp.communityhealth.media.
  Value: _abc123xyz.acm-validations.aws.
  TTL:   600
```

### 2. Add the CNAME in GoDaddy immediately

1. Go to [dns.godaddy.com](https://dns.godaddy.com) → select **communityhealth.media**
2. Click **Add** → **CNAME**
3. Enter the values from the script:

   | Field | What to enter |
   |-------|----------------|
   | **Type** | CNAME |
   | **Name** | `_acme-challenge.testapp` *(if GoDaddy wants host only)* or `_acme-challenge.testapp.communityhealth.media` *(if it wants full FQDN)* |
   | **Value** | The Value from the script (e.g. `_abc123xyz.acm-validations.aws.`) – **no trailing dot** in most UIs |
   | **TTL** | 600 (or 10 min) |

4. Save the record.

**GoDaddy format notes:**
- If the Name field is “relative to zone”, use: `_acme-challenge.testapp`
- If it expects the full record name, use: `_acme-challenge.testapp.communityhealth.media`
- Do **not** add a trailing dot to the Value in GoDaddy (some UIs add it automatically)

### 3. Verify DNS before ACM checks

```bash
dig _acme-challenge.testapp.communityhealth.media CNAME +short
```

You should see the ACM validation value (e.g. `_abc123xyz.acm-validations.aws.`). If empty, the record is wrong or not propagated yet.

### 4. Check certificate status

```bash
./scripts/check-certificates-status.sh testapp
```

Wait until status is **ISSUED** (often 5–30 minutes, sometimes up to an hour).

### 5. If it stays PENDING_VALIDATION

- **Check the record** – `dig _acme-challenge.testapp.communityhealth.media CNAME +short`
- **Fix the Name** – Try `_acme-challenge.testapp` vs `_acme-challenge.testapp.communityhealth.media` depending on GoDaddy
- **Fix the Value** – Must match exactly what ACM gave you (no typos, no extra dots unless ACM shows one)
- **Wait for propagation** – Can take up to 48 hours, but usually 5–30 minutes

---

## Why It Timed Out Last Time

Common causes:

1. **CNAME added too late** – Add it within hours of requesting the cert.
2. **Wrong Name format** – GoDaddy’s “Name” field varies; try both host-only and full FQDN.
3. **Wrong Value** – Copy-paste from the script output; avoid manual edits.
4. **Record in wrong zone** – Must be in the `communityhealth.media` zone, not a subdomain zone.
5. **Subdomain delegation** – If `testapp` is delegated to another DNS, add the CNAME in that delegated zone instead.

---

## Quick Checklist

- [ ] Run `./scripts/request-certificate-testapp.sh`
- [ ] Copy Name and Value from output
- [ ] Add CNAME in GoDaddy within a few hours
- [ ] Run `dig _acme-challenge.testapp.communityhealth.media CNAME +short` to confirm
- [ ] Run `./scripts/check-certificates-status.sh testapp` until ISSUED
- [ ] Update `dev.tfvars` with `domain_name` and cert ARNs
