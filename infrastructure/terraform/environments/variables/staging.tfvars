# CHT Platform - us-east-1 STAGING
# Domain: staging.testapp.communityhealth.media
#
# Non-secret infra config lives here (safe to commit).
# Application secrets: set via GitHub Actions TF_VAR_* (deploy-staging.yml) or
# export TF_VAR_hubspot_access_token=... etc. for local terraform apply.
#
# For local fills, copy staging.tfvars.example → staging.local.tfvars (gitignored).

project     = "cht-platform"
environment = "staging"

# Docker Images
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:staging-latest"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:staging-latest"

# Database — minimal sizing
rds_instance_class    = "db.t3.micro"
rds_allocated_storage = 20
rds_multi_az          = false
rds_backup_retention  = 1

# Compute — small (1 task each, scale to 2 max)
backend_task_cpu      = 256
backend_task_memory   = 512
backend_desired_count = 1
backend_min_capacity  = 1
backend_max_capacity  = 2

worker_task_cpu      = 256
worker_task_memory   = 512
worker_desired_count = 1
worker_min_capacity  = 1
worker_max_capacity  = 2

# SSL Certificates — reuse existing wildcard cert (*.testapp.communityhealth.media)
acm_certificate_arn        = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"
cloudfront_certificate_arn = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"

# Domain
domain_name = "staging.testapp.communityhealth.media"

# Public auth URL (not a secret)
supabase_url = "https://mediahub.communityhealth.media"

# MediaHub Public API — shared across envs
mediahub_base_url = "https://mediahub.communityhealth.media/api/public"

# Jotform (non-secret form IDs / URLs)
jotform_webinar_post_event_shared_form_id = "260698533879881"
jotform_webinar_default_intake_url        = "https://communityhealthmedia.jotform.com/261116295463861"

# SQS queue URLs (from Terraform SQS module — staging environment)
sqs_email_queue_url   = "https://sqs.us-east-1.amazonaws.com/233636046512/cht-platform-staging-email-queue"
sqs_payment_queue_url = "https://sqs.us-east-1.amazonaws.com/233636046512/cht-platform-staging-payment-queue"
sqs_cme_queue_url     = "https://sqs.us-east-1.amazonaws.com/233636046512/cht-platform-staging-cme-queue"

# Worker / session reminders
worker_ses_from_email                 = "info@communityhealth.media"
session_reminders_schedule_expression = "cron(0 0/6 * * ? *)"

# Application secrets — DO NOT commit real values. GitHub Actions sets TF_VAR_* on deploy.
# supabase_url            = ""
# supabase_anon_key       = ""
# gotrue_jwt_secret       = ""
# mediahub_api_key        = ""
# youtube_api_key         = ""
# youtube_playlist_ids    = ""
# zoom_account_id         = ""
# zoom_client_id          = ""
# zoom_client_secret      = ""
# zoom_webhook_secret     = ""
# zoom_sdk_key            = ""
# zoom_sdk_secret         = ""
# jotform_api_key         = ""
# bill_dev_key            = ""
# bill_username           = ""
# bill_password           = ""
# bill_org_id             = ""
# bill_funding_account_id = ""
# bill_webhook_secret     = ""
# admin_bootstrap_secret  = ""
# hubspot_access_token    = ""
