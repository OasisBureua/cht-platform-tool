# CHT Platform - us-east-1 (Primary Region)

project     = "cht-platform"
environment = "prod"

# Docker Images (update with production tags)
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:v1.0.8"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:v1.0.8"

# Database - Production sizing
rds_instance_class    = "db.t3.small"
rds_allocated_storage = 100
rds_multi_az          = true
rds_backup_retention  = 30

# Cache - Production sizing
redis_node_type = "cache.t3.small"
redis_num_nodes = 2

# Compute - Production sizing
backend_task_cpu      = 512
backend_task_memory   = 1024
backend_desired_count = 3
backend_min_capacity  = 2
backend_max_capacity  = 10

worker_task_cpu      = 512
worker_task_memory   = 1024
worker_desired_count = 2
worker_min_capacity  = 1
worker_max_capacity  = 20

# SSL Certificates (add after requesting)
# acm_certificate_arn        = "arn:aws:acm:us-east-1:233636046512:certificate/..."
# cloudfront_certificate_arn = "arn:aws:acm:us-east-1:233636046512:certificate/..."

# Domain
domain_name = "communityhealth.media"

# MediaHub Public API (catalog) - get from MediaHub/CHM team
# mediahub_api_key = ""

# Bill.com (payment processing - HCP payouts via ACH/check)
# API: https://developer.bill.com/reference/api-reference-overview
# Set via TF_VAR_* or Secrets Manager. Never commit real values.
# bill_dev_key             = ""
# bill_username           = ""
# bill_password           = ""
# bill_org_id             = ""
# bill_funding_account_id = ""

# Application Secrets (REQUIRED for production)
# Use environment variables or AWS Secrets Manager:
# export TF_VAR_stripe_secret_key="sk_live_..."
# stripe_secret_key      = ""
# stripe_publishable_key = ""
# stripe_webhook_secret  = ""
# auth0_domain           = ""
# auth0_client_id        = ""
# auth0_audience         = ""

# Monitoring (REQUIRED for production)
# alarm_notification_emails = ["ops@example.com"]

# Cost: ~$268/month