# Documentation

Project documentation and guides.

## Email (HubSpot)

Transactional emails are sent via HubSpot SMTP. With no credentials configured, the worker logs emails only. To enable:

1. In HubSpot: **Settings → Integrations → Email** (or Transactional Email)
2. Create an SMTP API token
3. Set `HUBSPOT_SMTP_USER` and `HUBSPOT_SMTP_PASSWORD` in worker `.env` (or via Terraform secrets)