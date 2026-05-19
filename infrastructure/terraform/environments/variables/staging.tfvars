# CHT Platform - us-east-1 STAGING
# Domain: staging.testapp.communityhealth.media
# Purpose: isolated environment for testing schema migrations, integration changes,
#          and content-platform work before promoting to testapp.
#
# Cost target: ~$80-100/month (smaller than dev)
#
# Copy to staging.tfvars (gitignored) and fill in real values from
# ~/Downloads/testapp secrets or AWS Secrets Manager.

project     = "cht-platform"
environment = "staging"

# Docker Images
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:staging-latest"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:staging-latest"

# Database — minimal sizing
rds_instance_class      = "db.t3.micro"
rds_allocated_storage   = 20
rds_multi_az            = false
rds_backup_retention    = 1

# Cache — minimal sizing
redis_node_type         = "cache.t3.micro"
redis_num_nodes         = 1

# Compute — small (1 task each, scale to 2 max)
backend_task_cpu        = 256
backend_task_memory     = 512
backend_desired_count   = 1
backend_min_capacity    = 1
backend_max_capacity    = 2

worker_task_cpu         = 256
worker_task_memory      = 512
worker_desired_count    = 1
worker_min_capacity     = 1
worker_max_capacity     = 2

# SSL Certificates — reuse existing wildcard cert (*.testapp.communityhealth.media)
acm_certificate_arn        = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"
cloudfront_certificate_arn = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"

# Domain
domain_name = "staging.testapp.communityhealth.media"

# MediaHub Public API — same as dev (single MediaHub instance shared across envs)
mediahub_base_url = "https://mediahub.communityhealth.media/api/public"
# mediahub_api_key = ""  # set via TF_VAR or fill from testapp secrets file

# Application secrets — set via TF_VAR_* or fill from testapp secrets file.
# Most values can be reused from dev since the underlying integrations
# (GoTrue, MediaHub API, YouTube, Zoom, JotForm, Bill.com sandbox, HubSpot)
# are environment-agnostic.
#
# supabase_url            = ""
# supabase_anon_key       = ""
# gotrue_jwt_secret       = ""
# youtube_api_key         = ""
# youtube_playlist_ids    = ""
# zoom_account_id         = ""
# zoom_client_id          = ""
# zoom_client_secret      = ""
# zoom_webhook_secret     = ""
# jotform_api_key         = ""
# bill_dev_key            = ""
# bill_username           = ""
# bill_password           = ""
# bill_org_id             = ""
# bill_funding_account_id = ""
# bill_webhook_secret     = ""
# admin_bootstrap_secret  = ""  # generate fresh for staging (one-time-use)
# hubspot_access_token    = ""
