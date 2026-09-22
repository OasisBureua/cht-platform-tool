# Documentation

Operational docs for the CHT Platform. Start here:

| Doc | Purpose |
|-----|---------|
| [engineering/getting-started.md](./engineering/getting-started.md) | Local development setup |
| [engineering/architecture.md](./engineering/architecture.md) | System design and data flows |
| [engineering/chmbot-migration-architecture.md](./engineering/chmbot-migration-architecture.md) | CHT Companion (cht-companion) on ECS Service Connect + cht-companion-db/pgvector |
| [engineering/platform-cost-reduction.md](./engineering/platform-cost-reduction.md) | Cost cuts: MediaHub EC2 off, dev lightswitch, right-sizing |
| [engineering/deployment.md](./engineering/deployment.md) | Staging and production deploys |
| [engineering/integrations.md](./engineering/integrations.md) | Auth, Zoom, JotForm, Bill.com, MediaHub |
| [engineering/stripe-migration.md](./engineering/stripe-migration.md) | Bill.com → Stripe Connect migration plan |
| [engineering/zoom-recordings-pull-guide.md](./engineering/zoom-recordings-pull-guide.md) | Zoom cloud recording download + reports (Sebastien/Syed) |
| [engineering/content-hub-cht-proxy.md](./engineering/content-hub-cht-proxy.md) | Content Hub admin UI → CHT proxy → Hub |
| [engineering/content-hub-report-api-contract.md](./engineering/content-hub-report-api-contract.md) | Campaign & report API contract |
| [engineering/survey-response-analytics-api.md](./engineering/survey-response-analytics-api.md) | Survey response analytics API contract (admin charts) |
| [runbooks/](./runbooks/) | Platform migration runbooks (Cognito, staging teardown, MediaHub) |
| [reports/CHM-Platform-Roadmap-Plan.md](./reports/CHM-Platform-Roadmap-Plan.md) | Master roadmap (dev, Cognito, MediaHub) |
| [compliance/](./compliance/) | SOC 2 runbooks (incident response, disaster recovery) |

CI workflow details: [.github/CI_CD.md](../.github/CI_CD.md)

Infrastructure modules and Terraform layout: [infrastructure/README.md](../infrastructure/README.md)
