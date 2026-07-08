# CHT Platform — dev.github.tfvars
# Non-secret infra for GitHub Actions deploy-dev.yml (committed).
# Secrets: GitHub Environment "development" → TF_VAR_* (see .github/CI_CD.md).
# Local dev: copy dev.tfvars.example → dev.tfvars and add secrets inline or via TF_VAR_*.

project     = "cht-platform"
environment = "dev"

# Domain and certificates (devapp)
domain_name             = "devapp.communityhealth.media"
acm_certificate_arn     = "arn:aws:acm:us-east-1:233636046512:certificate/6a358a7c-fe5d-4bbe-8d09-b0fce55c61b7"
cloudfront_certificate_arn = "arn:aws:acm:us-east-1:233636046512:certificate/6a358a7c-fe5d-4bbe-8d09-b0fce55c61b7"

# Images are overridden per deploy by workflow (-var backend_image / worker_image)
backend_image = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:3.0.0"
worker_image  = "233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-worker:3.0.0"

# Database (small dev)
rds_instance_class    = "db.t3.micro"
rds_engine_version    = "15.17"
rds_allocated_storage = 20
rds_multi_az          = false
rds_backup_retention  = 1

# Compute (dev autoscaling floor)
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

# DR / replication (dev usually single-region)
secrets_replica_regions   = []
enable_ecr_replication    = false
secondary_api_origin_domain = ""
route_api_to_secondary    = false

# Non-secret app configuration required by Terraform
supabase_url         = "https://mediahub.communityhealth.media"
mediahub_base_url    = "https://mediahub.communityhealth.media/api/public"
youtube_playlist_ids = "PL2Hl5AUWjkcgx53RC-gosoVkylHK2gFxM,PL2Hl5AUWjkcjk3q6xz7EBRPnAWWrcfktZ,PL2Hl5AUWjkch8F7LYwrK7ZSkeuIu1uZ1v,PL2Hl5AUWjkcjkeCwnexDW5A35YW6dCpz8,PL2Hl5AUWjkcj4cuPQAXMyHtcPgcDRhWiq,PL2Hl5AUWjkch0BhbecHExDoFI-BIOCuvp,PL2Hl5AUWjkchqQepKWLujRJqTzWBq7ga3,PL2Hl5AUWjkcj1AMFtfkKNxWru-8oqXiE_,PL2Hl5AUWjkcgctNi0rmnc_UcGhfgVBQ5w,PL2Hl5AUWjkchY4CKaO-YFbzZ85bmIrDLA,PL2Hl5AUWjkci_7ihXb_CxYRx44m5advu4,PL2Hl5AUWjkcgiwYUMn1xZE0OcJ7kkFgC_,PL2Hl5AUWjkchaSnGOSPayrLvVI5VZw-Xr,PL2Hl5AUWjkchKrBR4U7qR34jnrxJ-cFnd,PL2Hl5AUWjkciT76SNZ8KF8YuUBA-J5Zmj,PL2Hl5AUWjkcjmsRaEGRABoVIGpFDB-mKX,PL2Hl5AUWjkcgHOME-3DuV__2NGIqieLbR,PL2Hl5AUWjkciojcG6OcXr53j6CVbUCKaH,PL2Hl5AUWjkchgKKgSKqSsmFsXAIzti2eh,PL2Hl5AUWjkcg9IswomQR5PAFwEE7GeR0q,PL2Hl5AUWjkci9phIT_iBNkmaUp4hv2IId,PL2Hl5AUWjkcjQ1qYVwjWWcwaJNnp3b6OA,PL2Hl5AUWjkcjDYB2OkFzYrBiZV8r9-RPm,PL2Hl5AUWjkchGE0Ih3iTYgA0QGrGeIyuZ,PL2Hl5AUWjkcj56vpMhTrmzyiw86r-CAvt,PL2Hl5AUWjkcijhM_JbPRxMWvRdMW3ceuD,PL2Hl5AUWjkciIjpJ6mSA9uGjfPFL4Hn0P"
contenthub_base_url   = "https://devhub.communityhealth.media/api/public"
worker_ses_from_email = "info@communityhealth.media"
session_reminders_schedule_expression = "cron(0 0/12 * * ? *)"
enable_cognito_pools                  = true
cognito_domain_prefix                 = "chm-dev"
cognito_user_pool_tier                = "ESSENTIALS"
cognito_mfa_configuration             = "OPTIONAL"
cognito_email_sending_account         = "DEVELOPER"
cognito_email_from                    = "noreply@communityhealth.media"
cognito_email_reply_to                = "info@communityhealth.media"
enable_cognito_waf                    = true
enable_cognito_mrr                    = true
cognito_mrr_replica_region            = "us-east-2"
cognito_mrr_associate_waf_replica     = false

