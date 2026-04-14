# Documentation

Project documentation and guides.

## testapp.communityhealth.media (DNS on GoDaddy)

To deploy the app at `testapp.communityhealth.media` with DNS on GoDaddy: **[TESTAPP-DEPLOYMENT-GODADDY.md](./TESTAPP-DEPLOYMENT-GODADDY.md)** — request ACM certificate first, add CNAME in GoDaddy for validation, then deploy Terraform and add NS records.

## Email (Amazon SES)

Transactional emails are sent via Amazon SES. Verify your sending domain in SES first. The worker uses the ECS task IAM role for SES access. Set `SES_FROM_EMAIL` in worker `.env` (e.g. `noreply@communityhealth.media`).