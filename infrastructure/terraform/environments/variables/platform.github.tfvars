# CHT Platform: platform.github.tfvars
# Non-secret infra for GitHub Actions deploy-prod.yml (committed).
# Secrets: GitHub Environment "platform" → TF_VAR_* (see .github/CI_CD.md).
# Local prod: copy platform.tfvars.example → platform.tfvars and add secrets.

project     = "cht-platform"
environment = "platform"

domain_name = "testapp.communityhealth.media"

# Images overridden per deploy by workflow (-var backend_image / worker_image)
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:v1.0.0"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:v1.0.0"

rds_instance_class    = "db.t3.small"
rds_engine_version    = "15.17"
rds_allocated_storage = 20
rds_multi_az          = true
rds_backup_retention  = 7

enable_aurora_global  = true
aurora_instance_class = "db.r6g.large"
aurora_engine_version = "15.17"
aurora_use_for_app    = true
decommission_rds      = true

backend_task_cpu      = 512
backend_task_memory   = 1024
backend_desired_count = 2
backend_min_capacity  = 2
backend_max_capacity  = 2

worker_task_cpu      = 512
worker_task_memory   = 1024
worker_desired_count = 2
worker_min_capacity  = 2
worker_max_capacity  = 2

acm_certificate_arn        = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"
cloudfront_certificate_arn = "arn:aws:acm:us-east-1:233636046512:certificate/3d4f17ef-46f3-45a2-84a0-c61fb94769bb"
dr_acm_certificate_arn     = "arn:aws:acm:us-east-2:233636046512:certificate/e99c8853-8cac-4733-80dc-f1515335b804"

secrets_replica_regions     = ["us-east-2"]
enable_ecr_replication        = true
secondary_api_origin_domain   = "cht-platform-dr-use2-alb-455710402.us-east-2.elb.amazonaws.com"
# deploy-prod.yml mirrors deploy-dev (us-east-1 ECS only). Secondary ECS later via deploy-secondary.sh.
route_api_to_secondary      = false
dr_rds_instance_class       = "db.t3.small"

# Non-secret app configuration required by Terraform
supabase_url         = "https://mediahub.communityhealth.media"
mediahub_base_url    = "https://mediahub.communityhealth.media/api/public"
youtube_playlist_ids = "PL2Hl5AUWjkcgx53RC-gosoVkylHK2gFxM,PL2Hl5AUWjkcjk3q6xz7EBRPnAWWrcfktZ,PL2Hl5AUWjkch8F7LYwrK7ZSkeuIu1uZ1v,PL2Hl5AUWjkcjkeCwnexDW5A35YW6dCpz8,PL2Hl5AUWjkcj4cuPQAXMyHtcPgcDRhWiq,PL2Hl5AUWjkch0BhbecHExDoFI-BIOCuvp,PL2Hl5AUWjkchqQepKWLujRJqTzWBq7ga3,PL2Hl5AUWjkcj1AMFtfkKNxWru-8oqXiE_,PL2Hl5AUWjkcgctNi0rmnc_UcGhfgVBQ5w,PL2Hl5AUWjkchY4CKaO-YFbzZ85bmIrDLA,PL2Hl5AUWjkci_7ihXb_CxYRx44m5advu4,PL2Hl5AUWjkcgiwYUMn1xZE0OcJ7kkFgC_,PL2Hl5AUWjkchaSnGOSPayrLvVI5VZw-Xr,PL2Hl5AUWjkchKrBR4U7qR34jnrxJ-cFnd,PL2Hl5AUWjkciT76SNZ8KF8YuUBA-J5Zmj,PL2Hl5AUWjkcjmsRaEGRABoVIGpFDB-mKX,PL2Hl5AUWjkcgHOME-3DuV__2NGIqieLbR,PL2Hl5AUWjkciojcG6OcXr53j6CVbUCKaH,PL2Hl5AUWjkchgKKgSKqSsmFsXAIzti2eh,PL2Hl5AUWjkcg9IswomQR5PAFwEE7GeR0q,PL2Hl5AUWjkci9phIT_iBNkmaUp4hv2IId,PL2Hl5AUWjkcjQ1qYVwjWWcwaJNnp3b6OA,PL2Hl5AUWjkcjDYB2OkFzYrBiZV8r9-RPm,PL2Hl5AUWjkchGE0Ih3iTYgA0QGrGeIyuZ,PL2Hl5AUWjkcj56vpMhTrmzyiw86r-CAvt,PL2Hl5AUWjkcijhM_JbPRxMWvRdMW3ceuD,PL2Hl5AUWjkciIjpJ6mSA9uGjfPFL4Hn0P"
sqs_email_queue_url                 = "https://sqs.us-east-1.amazonaws.com/233636046512/cht-platform-email-queue"
sqs_payment_queue_url               = "https://sqs.us-east-1.amazonaws.com/233636046512/cht-platform-payment-queue"
sqs_cme_queue_url                   = "https://sqs.us-east-1.amazonaws.com/233636046512/cht-platform-cme-queue"
worker_ses_from_email               = "info@communityhealth.media"
alarm_notification_emails = [
  "uchenna@communityhealth.media",
  "sebastien@communityhealth.media",
]
session_reminders_schedule_expression = "cron(0 0/6 * * ? *)"
enable_bill_mfa_reminder              = true
enable_cognito_pools                = true
cognito_domain_prefix               = "chm-platform"
cognito_user_pool_tier              = "ESSENTIALS"
cognito_mfa_configuration           = "OPTIONAL"
cognito_email_sending_account       = "DEVELOPER"
cognito_email_from                  = "noreply@communityhealth.media"
cognito_email_reply_to              = "info@communityhealth.media"
enable_cognito_waf                  = true
enable_cognito_mrr                  = true
cognito_mrr_replica_region          = "us-east-2"
cognito_mrr_associate_waf_replica   = true

# Non-secret app configuration (same pattern as dev.github.tfvars)
contenthub_base_url = "https://contenthub.communityhealth.media/api/public"

# Redis cache for upstream ContentHub / MediaHub reads (4h TTL in app)
enable_elasticache    = true
elasticache_node_type = "cache.t3.medium"
