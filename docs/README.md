# Documentation

Project documentation and guides.

## testapp.communityhealth.media (DNS on GoDaddy)

To deploy the app at `testapp.communityhealth.media` with DNS on GoDaddy: **[TESTAPP-DEPLOYMENT-GODADDY.md](./TESTAPP-DEPLOYMENT-GODADDY.md)** — request ACM certificate first, add CNAME in GoDaddy for validation, then deploy Terraform and add NS records.

## Email (HubSpot)

Transactional emails are sent via HubSpot SMTP. With no credentials configured, the worker logs emails only. To enable:

1. In HubSpot: **Settings → Integrations → Email** (or Transactional Email)
2. Create an SMTP API token
3. Set `HUBSPOT_SMTP_USER` and `HUBSPOT_SMTP_PASSWORD` in worker `.env` (or via Terraform secrets)