# us-east-2 DR Infrastructure (active-passive)

Standby regional stack for disaster recovery with:

- DR ECS/ALB in `us-east-2`
- Cross-region RDS read replica (optional, enabled by default)
- DR-local Secrets Manager copies sourced from `us-east-1`
- Output `secondary_api_origin_domain` for CloudFront API origin failover

## Deploy

```bash
cd infrastructure/terraform/environments/us-east-2
terraform init
terraform plan -var-file=../variables/platform.tfvars -out=dr.plan
terraform apply dr.plan
```

## After deploy

1. Capture output:
   - `terraform output secondary_api_origin_domain`
2. Set in `environments/variables/platform.tfvars`:
   - `secondary_api_origin_domain = "<output value>"`
3. Apply `us-east-1` stack to activate CloudFront API origin failover.

## Notes

- Public DNS still points to the single CloudFront distribution.
- CloudFront handles API failover between primary and secondary ALB origins.
- Frontend static assets should be deployed to both regional S3 buckets via CI.
- **ECR:** `contenthub-*` and `cht-platform-*` images replicate us-east-1 → us-east-2 via the account-level replication ruleset (configured on any us-east-1 apply with `enable_ecr_replication = true`). Both prefixes must stay in Terraform or ContentHub DR waits break.
- **GuardDuty:** A detector is enabled in us-east-2; findings route to the regional SNS alerts topic.