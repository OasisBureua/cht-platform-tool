# Terraform remote state keys

Platform (testapp) and dev (devapp) use the **same** Terraform code under `us-east-1/` and `us-east-2/` but **separate S3 state files** so dev apply never replaces platform resources.

| Environment | Primary state key | DR state key |
| ----------- | ----------------- | ------------ |
| platform    | `us-east-1/terraform.tfstate` | `us-east-2/terraform.tfstate` |
| dev         | `us-east-1-dev/terraform.tfstate` | `us-east-2-dev/terraform.tfstate` |

## Init before plan/apply

```bash
cd infrastructure/terraform/environments/us-east-1
terraform init -reconfigure -backend-config=../backends/us-east-1-dev.hcl
terraform plan -var-file=../variables/dev.tfvars
```

Or use `./scripts/deploy-primary.sh dev` (selects the backend config automatically).

**Important:** Always `-reconfigure` when switching between platform and dev in the same directory.
