# CHT Platform - us-east-1 (Primary Region)

project     = "cht-platform"
environment = "dev"

# Docker Images (update after building/pushing)
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:v1.0.8"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:v1.0.8"

# Database
rds_instance_class    = "db.t3.micro"
rds_allocated_storage = 20
rds_multi_az          = false
rds_backup_retention  = 7

# Compute
backend_task_cpu      = 256
backend_task_memory   = 512
backend_desired_count = 2
backend_min_capacity  = 1
backend_max_capacity  = 4

worker_task_cpu      = 256
worker_task_memory   = 512
worker_desired_count = 1
worker_min_capacity  = 1
worker_max_capacity  = 10

# SSL Certificates (testapp - issued)
acm_certificate_arn        = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"
cloudfront_certificate_arn = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"
# us-east-2 DR ALB certificate (must be issued in us-east-2)
# dr_acm_certificate_arn     = "arn:aws:acm:us-east-2:233636046512:certificate/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Domain (testapp.communityhealth.media)
domain_name = "testapp.communityhealth.media"
# Secrets replication (cross-region DR)
secrets_replica_regions = ["us-east-2"]
# CloudFront API origin failover target (us-east-2 ALB DNS). Leave empty until DR ALB is deployed.
# secondary_api_origin_domain = "internal-cht-platform-dev-alb-xxxxxxxx.us-east-2.elb.amazonaws.com"

# MediaHub Public API (catalog - clips, tags, doctors, search)
# Get from MediaHub/CHM team. Set via TF_VAR_mediahub_api_key or here.
# mediahub_api_key = ""

# Bill.com (payment processing - get from team, API: https://developer.bill.com/reference/api-reference-overview)
# Set via TF_VAR_* or AWS Secrets Manager. Never commit real values.
# bill_dev_key             = ""
# bill_username           = ""
# bill_password           = ""
# bill_org_id             = ""
# bill_funding_account_id = ""

# Optional: Application secrets - use TF_VAR_* or Secrets Manager. Never commit.
# stripe_secret_key      = ""
# stripe_publishable_key = ""
# stripe_webhook_secret  = ""
# auth0_domain           = ""
# auth0_client_id        = ""
# auth0_audience         = ""

# Optional: SNS for alerts
# alarm_notification_emails = ["ops@example.com"]

# Cognito (Phase 2 — dev pool for testing before platform cutover)
# See docs/runbooks/cognito-migration-spec.md
enable_cognito_pools      = true
cognito_domain_prefix     = "chm-platform-dev"
cognito_user_pool_tier    = "ESSENTIALS"
cognito_mfa_configuration = "OPTIONAL"
# cognito_google_client_id     = ""  # Add when Google Cloud OAuth creds are ready
# cognito_google_client_secret = ""

# Cost: ~$145/month